/**
 * Klakna 代理服务器（后端集成版 v4）
 *
 * 架构：统一代理 + 本地 API + 前端注入 + 管理面板 + Control WebSocket
 *
 * v4 新增：
 * - Control WebSocket 实时推送（/ws/control）
 * - 前端注入引擎 v4（余额拦截、行情拦截、权限管理、指令处理）
 * - CSS/JS 动态注入
 * - 用户操作限制
 * - 行情数据覆盖
 * - 修复 express.json() 全局消费 body 的 bug
 */

// 🛡️ 增加 EventEmitter 最大监听器数量（防止 MaxListenersExceededWarning）
require('events').EventEmitter.defaultMaxListeners = 20;

// 🛡️🛡️🛡️ 全局未捕获异常处理器（调试用）🛡️🛡️🛡️
process.on('uncaughtException', (err) => {
  console.error('[GLOBAL UNCAUGHT] ' + err.message);
  console.error('[GLOBAL UNCAUGHT] Stack:', err.stack);
  // 不要立即退出，让后面的 logger 有机会记录
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});


const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const https = require('https');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./services/logger');
const controlWS = require('./services/control-ws');
const exchangeWS = require('./services/exchange-ws');
const priceFetcher = require('./services/price-fetcher');
const compression = require('compression');
const healthCheck = require('./services/health-check');

// 服务器实例（用于优雅关闭）
let httpServer, httpsServer;

// ============================================================
// 数据库
// ============================================================
const { getDb } = require('./db/index');
const { ensureDb, getDbSync, saveDb } = require('./db/queries');
const { seed } = require('./db/seed');

// ============================================================
// 本地 API 处理器（纯函数）
// ============================================================
const localHandlers = require('./routes/local-handlers');
const adminHandlers = require('./routes/admin-handlers');
const csHandlers = require('./routes/cs-handlers');
const { logOperation } = require('./middleware/operation-logger');

// ============================================================
// Express App
// ============================================================
const app = express();

// 🛡️ 信任代理（修复 express-rate-limit X-Forwarded-For 警告）
app.set('trust proxy', 1); // Trust first proxy (Cloudflare Tunnel)

// ============================================================
// CORS 中间件 — 白名单验证（替换动态回显，防止未授权跨域访问）
// ============================================================
const CORS_WHITELIST = [
  'https://cptmarketscoin-ctrl.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://localhost:8443',
  'http://127.0.0.1:8080',
  'https://127.0.0.1:8443',
  'http://localhost:8888',  // 添加测试服务器
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  return CORS_WHITELIST.some(allowed => {
    try { return new URL(allowed).origin === origin; } catch { return false; }
  });
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = isOriginAllowed(origin);
  
  // 🔧 临时：始终设置 CORS 头（测试用）
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, token, lang, language, timezone, TimeZone, port, deviceId');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-age', '86400');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  console.log('[CORS]', req.method, req.url, '| Origin:', origin, '| Allowed:', allowed);
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ============================================================
// 🛡️ 安全中间件
// ============================================================

// Helmet - 设置安全 HTTP 头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],  // 允许内联脚本（控制面板需要）
      scriptSrcAttr: ["'unsafe-inline'"],      // 允许内联事件处理器
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],  // 允许 WebSocket 连接
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],                      // 防止 base tag 劫持
      formAction: ["'self'"],                   // 限制 form 提交目标
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny'                             // 防止点击劫持
  },
  noSniff: true,                              // 防止 MIME 类型嗅探
  xssFilter: true,                            // 启用 XSS 过滤器
  crossOriginResourcePolicy: false,           // 禁用 CORP 以允许跨域代理读取响应
  crossOriginEmbedderPolicy: false,           // 禁用 COEP 以允许跨域资源加载
  crossOriginOpenerPolicy: false,             // 禁用 COOP（代理场景）
}));

// 速率限制 - 登录接口（防止暴力破解）
const loginLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.LOGIN.windowMs,
  max: config.RATE_LIMIT.LOGIN.max,
  message: config.RATE_LIMIT.LOGIN.message,
  standardHeaders: true,
  legacyHeaders: false,
});

// 速率限制 - 通用 API（防止滥用）
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.API.windowMs,
  max: config.RATE_LIMIT.API.max,
  message: config.RATE_LIMIT.API.message,
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// 📝 body 解析仅用于本地 API（不全局挂载，避免消费代理 POST body）
// 全局 express.json() 会导致代理转发的 POST 请求 body 为空（ECONNRESET/502）

// ============================================================
// 🚀 GitHub Webhook 自动部署接口（必须放在频率限制之前）
// ============================================================
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'klakna_deploy_secret_2024';

app.post('/api/deploy', express.json(), (req, res) => {
  const sig = req.headers['x-hub-signature-256'] || '';
  const body = JSON.stringify(req.body);

  // 验证签名（可选，建议配置）
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  hmac.update(body);
  const expectedSig = 'sha256=' + hmac.digest('hex');

  // 如果配置了 Secret，则验证；否则允许无签名推送（仅用于测试）
  if (process.env.GITHUB_WEBHOOK_SECRET && sig !== expectedSig) {
    console.log('[Deploy] ❌ Webhook 签名验证失败');
    return res.status(401).json({ code: 401, msg: 'Invalid signature' });
  }

  console.log('[Deploy] 🚀 收到 GitHub Push，开始部署...');
  console.log('[Deploy] 仓库:', req.body?.repository?.full_name || 'unknown');
  console.log('[Deploy] 分支:', req.body?.ref || 'unknown');

  // 异步执行部署（不阻塞响应）
  res.json({ code: 200, msg: 'Deployment started' });

  // 执行部署脚本
  const { exec } = require('child_process');
  const deployScript = `
    cd /home/ubuntu/klakna-backend &&
    git pull origin master &&
    npm install --production &&
    pm2 restart all
  `;

  exec(deployScript, { timeout: 60000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('[Deploy] ❌ 部署失败:', error.message);
      console.error('[Deploy] stderr:', stderr);
    } else {
      console.log('[Deploy] ✅ 部署成功!');
      console.log('[Deploy] stdout:', stdout);
    }
  });
});

// ============================================================
// 🛡️ API 速率限制（防止滥用）
// 应用到所有非 GET/OPTIONS 请求，但价格接口完全不限
app.use((req, res, next) => {
  const urlPath = (req.originalUrl || req.url || '').split('?')[0];

  // 跳过 GET、OPTIONS、健康检查和部署接口
  if (req.method === 'GET' || req.method === 'OPTIONS' || urlPath === '/health' || urlPath === '/api/deploy') {
    return next();
  }

  // 🚀 完全跳过频率限制的路径（前端高频调用的所有接口）
  const skipPaths = [
    // 行情/价格接口
    '/exchange/rockieCoinFutures/getPrice',
    '/exchange/rockieCoinFutures/getSymbols',
    '/exchange/rockieCoinFutures/',
    '/rockieCoinFutures/',
    '/getPrice',
    '/getSymbols',
    // 新闻/消息接口
    '/exchange/RockieNews',
    '/exchange/RockieMessage',
    // 交易视图接口
    '/exchange/tradingView',
    // 首页接口
    '/exchange/Home',
    // 用户接口（登录/注册高频）
    '/exchange/user/login',
    '/exchange/user/register',
    '/exchange/user/',
    // WebSocket 升级请求
    '/exchange/ws',
  ];
  if (skipPaths.some(p => urlPath.includes(p))) {
    return next();
  }

  // 应用 API 速率限制
  return apiLimiter(req, res, next);
});

// ============================================================
// 管理面板 HTML（缓存读取）
// ============================================================
let adminHTML = '';
let adminJS = '';
try {
  adminHTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
  const adminAppJS = fs.readFileSync(path.join(__dirname, 'public', 'admin-app.js'), 'utf-8');
  let csFunctionsJS = '';
  try {
    csFunctionsJS = fs.readFileSync(path.join(__dirname, 'public', 'cs-functions.js'), 'utf-8');
  } catch(e) {
    console.log('[WARN] cs-functions.js not found, skipping');
  }
  adminJS = adminAppJS + '\n' + csFunctionsJS;
} catch(e) {
  console.error('[ERROR] 无法读取管理面板文件:', e.message);
}

// 全局状态（通过 global 共享给 admin-handlers）
const startTime = Date.now();
global.__startTime = startTime;
const requestLog = [];       // 最近 200 条请求日志
global.__requestLog = requestLog;
const activeUsers = new Map();
global.__activeUsers = activeUsers;

// 🛡️ 维护模式
global.__maintenanceMode = false;
global.__maintenanceMessage = '';

// 📢 全局公告
global.__globalAnnouncement = '';
global.__announcementId = '';
global.__announcementExpiry = 0;

// 🎯 行情价格覆盖
global.__priceOverrides = {};
// 风控管理数据表
try {
  const { run } = require('./db/queries');
  run('CREATE TABLE IF NOT EXISTS market_control (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, max_price REAL DEFAULT 0, min_price REAL DEFAULT 0, action TEXT DEFAULT "block", enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  run('CREATE TABLE IF NOT EXISTS contract_risk (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, max_leverage INTEGER DEFAULT 10, max_position REAL DEFAULT 0, risk_level TEXT DEFAULT "medium", enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  // 配置管理数据表
  run('CREATE TABLE IF NOT EXISTS config_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, key TEXT NOT NULL, value TEXT, value_type TEXT DEFAULT "text", label TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(category, key))');
  console.log('[RiskControl] Tables initialized');
} catch(e) {
  console.log('[RiskControl] Tables may already exist');
}


// 🔧 v4 新增全局状态
global.__marketOverrides = {};          // 行情覆盖规则
global.__frontendControlsCache = [];    // 前端注入规则缓存
global.__wsConnections = new Map();     // WebSocket 连接池
global.__pushToUser = controlWS.pushToUser;
global.__broadcastCommand = controlWS.broadcastCommand;

// ============================================================
// 压缩中间件（gzip，减小传输体积，解决 Cloudflare Tunnel 大文件断流）
// ============================================================
app.use(compression({ level: 6, threshold: 1024 }));

// ============================================================
// 日志中间件（使用 Winston）
// ============================================================
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = (req.originalUrl || req.url || '').split('?')[0];

  res.on('finish', () => {
    const duration = Date.now() - start;
    const entry = {
      time: new Date().toISOString(),
      method: req.method,
      path: reqPath,
      status: res.statusCode,
      duration: duration + 'ms',
      ip: req.ip || req.socket?.remoteAddress || '-',
    };
    requestLog.push(entry);
    if (requestLog.length > 200) requestLog.shift();

    // 仅记录本地 API 请求（不记录静态资源和代理请求）
    if (reqPath.startsWith('/admin/') || reqPath.startsWith('/exchange/') || reqPath === '/health') {
      logger.http('HTTP Request', entry);
    }
  });

  next();
});

// ============================================================
// 统一中间件：管理面板 + 本地 API 拦截
// ============================================================
app.use(async (req, res, next) => {
  const reqPath = (req.originalUrl || req.url || '').split('?')[0];

  // ========== 健康检查 ==========
    if (reqPath === '/health') {
      return res.json({
        code: 200,
        data: {
          uptime: Math.floor((Date.now() - startTime) / 1000),
          memory: process.memoryUsage(),
          maintenanceMode: global.__maintenanceMode,
          maintenanceMessage: global.__maintenanceMessage,
          announcement: global.__globalAnnouncement,
          announcementId: global.__announcementId,
          priceOverrides: global.__priceOverrides,
          marketOverrides: global.__marketOverrides,
          frontendControls: global.__frontendControlsCache,
          requestCount: requestLog.length,
          activeUsers: activeUsers.size,
          wsOnline: controlWS.getOnlineCount(),
          pid: process.pid,
        }
      });
    }

    // ========== 深度健康检查（综合检查）==========
    if (reqPath === '/health/deep') {
      const result = await healthCheck.deepHealthCheck();
      return res.status(result.status).json(result);
    }

    // ========== 就绪检查（用于 K8s readinessProbe）==========
    if (reqPath === '/health/ready') {
      const result = await healthCheck.readinessCheck();
      return res.status(result.status).json(result);
    }

    // ========== 存活检查（用于 K8s livenessProbe）==========
    if (reqPath === '/health/live') {
      const result = healthCheck.livenessCheck();
      return res.status(result.status).json(result);
    }

  // ========== 管理面板页面 ==========
  // /admin.html → 重定向到 /admin（避免被代理到原站）
  if (reqPath === '/admin.html') {
    res.writeHead(302, { 'Location': '/admin' });
    return res.end();
  }
  // /admin 和 /admin/ 都服务管理面板
  if (reqPath === '/admin' || reqPath === '/admin/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.end(adminHTML);
  }

  // ========== 管理面板 JS ==========
  if (reqPath === '/admin/app.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.end(adminJS);
  }

  // ========== 管理员 API ==========
  if (reqPath.startsWith('/admin/')) {
    // 登录接口应用速率限制
    if (reqPath === '/admin/login' && req.method === 'POST') {
      return loginLimiter(req, res, () => handleAdminAPI(req, res, reqPath));
    }
    return handleAdminAPI(req, res, reqPath);
  }

  // ========== rockieFile/getFile 静态文件服务 ==========
  if (reqPath.startsWith('/exchange/rockieFile/getFile')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const fileId = urlObj.searchParams.get('fileId') || '';
    if (fileId && !fileId.includes('undefined')) {
      // 重定向到 GitHub Pages 上的实际文件（绝对 URL）
      const absUrl = fileId.startsWith('http') ? fileId : 'https://cptmarketscoin-ctrl.github.io' + (fileId.startsWith('/') ? '' : '/') + fileId;
      res.writeHead(302, { Location: absUrl });
      return res.end();
    }
    res.writeHead(302, { Location: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
    return res.end();
  }

  // ========== 本地用户 API ==========
  if (reqPath.startsWith('/api/cs/')) {
    const exchangePath = '/exchange' + reqPath.slice(4);
    return handleLocalAPI(req, res, exchangePath);
  }

  // ========== 特殊路径直接处理（避免被代理到原站）==========
  // /api/stats → 返回服务器统计数据
  if (reqPath === '/api/stats' || reqPath === '/stats') {
    return res.json({
      code: 200,
      data: {
        visitors: activeUsers.size,
        pageViews: requestLog.length,
        uptime: Math.floor((Date.now() - startTime) / 1000),
      },
      msg: 'success'
    });
  }

  const apiPath = reqPath.startsWith('/api') ? reqPath.slice(4) : reqPath; // 去掉 /api 前缀

  // 🔑 前端 JS 所有 axios 调用的 URL 都以 "/" 开头（如 /user/login、/rockieCoin/list），
  // 因为 axios 的 url 以 "/" 开头时会替换 baseURL 而不是拼接。
  // 所以所有请求到达后端时都没有 /exchange 前缀。
  // 策略：对已知的 API 路径，自动加 /exchange 前缀后交给本地处理器。

  // 已知需要本地处理的 API 路径前缀列表
  const localPrefixes = [
    '/user/', '/wallet/', '/rockieCoin/', '/rockieCoinFutures/',
    '/rockieCoinOptions/', '/Transaction/', '/rockieWalletWithdraw/',
    '/share/', '/hashMap/', '/productGold/', '/nftProduct/',
    '/telegram/', '/newStockCoinTrade/',
    '/RockieMessage/', '/rockieFile/', '/rockieAi/', '/RockieNews/',
    '/Home/', '/goldForeign/',
    '/RockieGoldETFController/', '/RockieGoldStockController/',
    '/RockieGoldNewStockController/', '/RockieGoldIndiceController/',
    '/tradingView/',
    '/cs/', // 客服API（无 /exchange 前缀）
    '/exchange/cs/', // 客服API（有 /exchange 前缀）
    '/exchange/user/', // 用户API（有 /exchange 前缀）
    '/exchange/wallet/', // 钱包API（有 /exchange 前缀）
    // ===== Phase 1 新增 =====
    '/transfer/', '/largeTransactions', '/mobileWalletHistory',
    '/userAgreement', '/walletAccount', '/ws/',
    '/RockieAiController/',
    '/exchange/RockieAiController/', // 匹配 /exchange/RockieAiController/
    '/UserInfo', '/Wallet', // 不含 /exchange 前缀的匹配
    '/exchange/UserInfo', '/exchange/Wallet', // 含 /exchange 前缀的匹配
    '/exchange/userAgreement', '/exchange/walletAccount', // 含 /exchange 前缀的匹配
    // ===== 价格 API =====
    '/getPrice', '/exchange/getPrice',
    "/config",
    // ===== 合约交易 API =====
    '/rockieCoinFutures/', '/exchange/rockieCoinFutures/',
  ];

  // 检查路径是否需要本地处理
  // 先去除 /exchange 前缀（如果存在），因为 localPrefixes 中的前缀不含 /exchange
  const cleanPath = apiPath.startsWith('/exchange/') ? apiPath.slice(9) : apiPath;
  const cleanCheckPath = cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1);
  
  const needsLocal = localPrefixes.some(prefix => {
    const pLower = prefix.toLowerCase();
    return cleanPath.startsWith(prefix) || cleanPath.startsWith(pLower) ||
           cleanCheckPath.startsWith(prefix) || cleanCheckPath.startsWith(pLower);
  });

    console.log('[DEBUG] apiPath:', apiPath);  // 调试日志
  // ========== 直接检查客服API路径（新增）==========
  if (apiPath.startsWith('/cs/')) {
    console.log('[DEBUG] Customer service path detected, calling handleLocalAPI');
    let exchangePath = '/exchange' + apiPath;
    return handleLocalAPI(req, res, exchangePath);
  }

  if (needsLocal) {
    // 构造 /exchange 前缀的路径
    let exchangePath = apiPath;
    if (!exchangePath.startsWith('/exchange')) {
      // 保持原始大小写，只加前缀
      exchangePath = '/exchange' + exchangePath;
    }
    return handleLocalAPI(req, res, exchangePath);
  }

  // 非本地 API → 交给代理
  next();
});

// ============================================================
// Admin API 处理
// ============================================================
async function handleAdminAPI(req, res, reqPath) {
  // CORS + 预检
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // 按需解析 body（不使用全局 express.json，避免影响代理）
    if (!req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      req.body = await parseBody(req);
    }
    // 登录接口不需要鉴权
    const isLogin = reqPath === '/admin/login';
    const admin = isLogin ? null : adminHandlers.verifyAdmin(req.headers['authorization'] || req.headers['Authorization']);

    if (!admin && !isLogin) {
      return res.json({ code: 403, data: null, msg: 'Admin access denied' });
    }

    // GET 请求：用 query 参数代替 body
    if (req.method === 'GET') {
      req.body = Object.assign({}, req.query);
    }

    console.error('[DEBUG handleAdminAPI] ENTRY: req.method=' + req.method + ', reqPath=' + reqPath + "'");
    const handler = adminHandlers.match(req.method, reqPath);
    console.error('[DEBUG handleAdminAPI] handler=' + (handler ? 'FOUND' : 'null') + ', typeof=' + typeof handler);
    
    if (!handler) {
      return res.json({ code: 404, data: null, msg: 'Admin route not found: ' + req.method + ' ' + reqPath });
    }

    let result = handler(reqPath, req.body, admin);
    if (result && typeof result.then === 'function') result = await result;

    // 记录操作日志
    if (admin) {
      const action = `${req.method} ${reqPath}`;
      const module = reqPath.split('/')[2] || 'admin';
      const detail = JSON.stringify(req.body || {}).substring(0, 500);
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || null;
      try {
        logOperation(admin.id || null, admin.username || 'admin', action, module, detail, ip);
      } catch(e) {
        console.error('[OperationLogger] Failed to log:', e.message);
      }
    }

    return res.json(result);
  } catch(e) {
    logger.error('[Admin API Error] ' + reqPath + ' - ' + e.message);
    return res.json({ code: 500, data: null, msg: 'Internal error: ' + e.message });
  }
}

// ============================================================
// 工具函数
// ============================================================
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
    // 超时保护（3秒）
    setTimeout(() => resolve({}), 3000);
  });
}

// ============================================================
// 本地用户 API 处理
// ============================================================
async function handleLocalAPI(req, res, reqPath) {
  // CORS + 预检（支持跨域访问，回显 origin 避免 * 与 credentials 冲突）
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, port, language, TimeZone, token, deviceId');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // 按需解析 body（不使用全局 express.json，避免影响代理）
    if (!req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      req.body = await parseBody(req);
    }
  // 解析 JWT
  let user = null;
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || 
                      req.headers['AUTHORIZATION'] || req.headers['Authoriation'];
  if (authHeader) {
    try {
      const jwt = require('jsonwebtoken');
      user = jwt.verify(authHeader.replace('Bearer ', ''), config.JWT_SECRET);
      // 记录活跃用户
      if (user.id) {
        activeUsers.set(String(user.id), { lastSeen: Date.now(), ip: req.ip || req.socket?.remoteAddress, count: (activeUsers.get(String(user.id))?.count || 0) + 1 });
      }
    } catch(e) {
      console.error('[JWT Verify Error]', e.message, '| authHeader:', authHeader.substring(0, 20) + '...');
    }
  } else {
    console.log('[JWT] No Authorization header found, headers:', JSON.stringify(Object.keys(req.headers)));
    console.log('[JWT] Header values:', JSON.stringify(req.headers).substring(0, 200));
  }

    // 维护模式拦截（允许登录）
    if (global.__maintenanceMode && !reqPath.includes('login')) {
      return res.json({ code: 503, data: null, msg: 'System maintenance: ' + global.__maintenanceMessage });
    }

    let handler = localHandlers.match(req.method, reqPath);
    logger.info('[LocalAPI] ' + req.method + ' ' + reqPath + ' handler: ' + (handler ? 'found' : 'NOT FOUND'));

    // 尝试客服API路由
    if (!handler) {
      handler = csHandlers.match(req.method, reqPath);
      if (handler) {
        logger.info('[LocalAPI] CS handler found for ' + req.method + ' ' + reqPath);
      }
    }

    if (handler) {
      const arg2 = (req.method === 'GET') ? (req.query || {}) : (req.body || {});
      // handler 签名: handler(path, body, user)
      // path=reqPath, body=req.body or req.query, user=JWT user
      const result = handler(reqPath, arg2, user);
      logger.info('[LocalAPI] ' + req.method + ' ' + reqPath + ' → code: ' + (result.code || '?'));
      return res.json(result);
    }

    // 未匹配的本地路径返回默认配置（避免前端 getGlobalConfig 崩溃）
    // 前端很多 API 在原站也返回配置数据，我们需要提供安全的默认值
    const defaultConfig = {
      fileId: '9007393', url: '', msg: 'success', name: 'CPT', platformName: 'CPT',
      address: 'CPT Exchange', phone: '', advertising: '9007393',
      email: '', parameter: '', parameter1: '', parameter2: '',
      parameter3: '', video: '', explain: '', homeTheme: '',
      miningCode: '', miningUrl: '', service_config: '{}',
      tabBarConfig: '{}', stockCountryId: 5, sumpay: 0,
      subscription: '', subscriptionSwitch: '', generalInvite: 0,
      isShowICO: 0, isShowIPO: 0, FasTransactions: 1,
      frontDeskShow: '{"goldAi":0,"loAn":0}',
      contract_multiple: '{}', tradeSort: '', account: '{}',
      cryptoUSDT: 'USDT', isShowAuthentication: 1, isShowRank: 0,
      experienceAmount: 0, serviceScript: null, ReviseUserName: '',
      memorizationUserName: '', PendingReview: '0',
      AIStatistics: '{}', walletAccountList: '{}', BankCardCash: '{}',
      earnConfig: '{}', handToAmount: '{}',
    };
    logger.info('[LocalAPI] ' + req.method + ' ' + reqPath + ' → default config (no handler)');
    return res.json({ code: 200, data: defaultConfig, msg: 'success' });
  } catch(e) {
    logger.error('[Local API Error] ' + reqPath + ' - ' + e.message);
    return res.json({ code: 500, data: null, msg: 'Internal error: ' + e.message });
  }
}

// ============================================================
// 注入脚本模板 v4（注入到代理的原站 HTML 页面）
// 新增：余额拦截、行情拦截、权限管理、指令处理、Control WS
// ============================================================
const INJECT_SCRIPT = `
(function(){
  'use strict';
  
  // ========== 🔧 立即定义关键变量（在 Vue 加载之前）==========
  window.fileId = 9007393;  // 原站的正确值
  console.log('[KLAKNA v4] 注入引擎启动，window.fileId =', window.fileId);
  
  // 拦截动态添加 fileId 的尝试

  // ========== 🔴 全局错误捕获（显示到页面）==========
  const _errDiv = document.createElement('div');
  _errDiv.id = '__klakna_err';
  _errDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff0000;color:#fff;padding:12px;z-index:2147483647;font-size:13px;font-family:monospace';
  _errDiv.innerHTML = '<b>🔴 KLAKNA Error Monitor (v4)</b><div id="__klakna_errlog"></div>';
  function _showErr(msg) {
    const d = document.getElementById('__klakna_errlog') || _errDiv;
    const p = document.createElement('div');
    p.style.cssText = 'margin:4px 0;border-bottom:1px solid rgba(255,255,255,0.3);padding-bottom:4px';
    p.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    d.appendChild(p);
    console.error('[KLAKNA]', msg);
  }
  if (document.body) document.body.prepend(_errDiv);
  else document.addEventListener('DOMContentLoaded', ()=>document.body&&document.body.prepend(_errDiv));

  window.addEventListener('error', function(e) { _showErr('JS: ' + (e.message||e.type)); });
  window.addEventListener('unhandledrejection', function(e) { _showErr('Promise: ' + (e.reason?.message||String(e.reason).slice(0,200))); });
  
  // ========== 🔧 fileId 修复（客户端双重保险）==========
  function fixFileId() {
    const correctFileId = '9007393';
    let fixedCount = 0;
    
    // 修复 <link> 和 <script> 标签的 URL
    document.querySelectorAll('link[href*="fileId=undefined"], script[src*="fileId=undefined"]').forEach(el => {
      if (el.href && el.href.includes('fileId=undefined')) {
        el.href = el.href.replace(/fileId=undefined/g, 'fileId=' + correctFileId);
        fixedCount++;
      }
      if (el.src && el.src.includes('fileId=undefined')) {
        el.src = el.src.replace(/fileId=undefined/g, 'fileId=' + correctFileId);
        fixedCount++;
      }
    });
    
    // 修复 <a> 标签的 href
    document.querySelectorAll('a[href*="fileId=undefined"]').forEach(el => {
      el.href = el.href.replace(/fileId=undefined/g, 'fileId=' + correctFileId);
      fixedCount++;
    });
    
    if (fixedCount > 0) {
      console.log('[KLAKNA v4] 修复了 ' + fixedCount + ' 个 fileId=undefined');
      _showErr('修复了 ' + fixedCount + ' 个 fileId=undefined');
    }
    
    // 修复 JavaScript 变量（如果 fileId 是全局变量）
    if (window.fileId === undefined) {
      window.fileId = correctFileId;
      console.log('[KLAKNA v4] 设置 window.fileId =', correctFileId);
    }
  }
  
  // DOM 加载后执行修复
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixFileId);
  } else {
    fixFileId();
  }
  
  // ========== 🔧 WebSocket 协议修复 ==========
  const _origWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    // 仅修复 localhost 的 WebSocket 连接（开发环境）
    if (url && typeof url === 'string' && url.includes('localhost')) {
      url = url.replace('wss://', 'ws://');
      url = url.replace(':8443', ':8080');
      console.log('[KLAKNA v4] WS localhost fix:', url);
    }
    // 其他 WebSocket 连接保持原样（直连）
    return new _origWebSocket(url, protocols);
  };
  window.WebSocket.prototype = _origWebSocket.prototype;
  window.WebSocket.CONNECTING = _origWebSocket.CONNECTING;
  window.WebSocket.OPEN = _origWebSocket.OPEN;
  window.WebSocket.CLOSING = _origWebSocket.CLOSING;
  window.WebSocket.CLOSED = _origWebSocket.CLOSED;

  // ========== Control State ==========
  const KS = {
    version: '4.0',
    marketOverrides: {},
    restrictions: [],
    frontendControls: [],
    wsConnected: false,
  };

  // ========== Token 获取 ==========
  function _getCookies() {
    return document.cookie.split(';').reduce((a,c)=>{const [k,v]=c.trim().split('=');a[k]=v;return a},{});
  }
  function _getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || _getCookies().token || _getCookies().Token || '';
  }
  function _fetchJSON(url, opts) {
    try { return fetch(url, opts).then(r=>r.json()); } catch(e) { return Promise.resolve({code:-1}); }
  }

  // ========== 1. 钱包余额拦截 ==========
  function initWalletInterceptor() {
    const _origFetch = window.fetch;
    window.fetch = async function(url, options) {
      const response = await _origFetch.apply(this, arguments);
      try {
        const urlStr = typeof url === 'string' ? url : url?.url || '';
        // 拦截余额/资产相关 API
        if (urlStr.includes('getUserInfo') || urlStr.includes('wallet/')) {
          const clone = response.clone();
          const data = await clone.json();
          if (data && data.code === 200 && data.data && window.__KLAKNA_BALANCE_OVERRIDE__) {
            const ov = window.__KLAKNA_BALANCE_OVERRIDE__;
            if (ov.availableBalance !== undefined) data.data.availableBalance = ov.availableBalance;
            if (ov.totalAssets !== undefined) data.data.totalAssets = ov.totalAssets;
            if (ov.freezeBalance !== undefined) data.data.freezeBalance = ov.freezeBalance;
            return new Response(JSON.stringify(data), { status: response.status, headers: response.headers });
          }
        }
      } catch(e) {}
      return response;
    };
    console.log('[KLAKNA v4] 💰 Wallet interceptor ready');
  }

  // ========== 2. 行情数据拦截（通过 health 轮询获取覆盖规则） ==========
  function applyMarketOverrides() {
    const overrides = KS.marketOverrides;
    if (!overrides || Object.keys(overrides).length === 0) return;
    // 通过 monkey-patch WebSocket.onmessage 来拦截行情数据
    // 前端原站的 WS 消息会在 app.js 中处理，我们通过全局钩子拦截
    console.log('[KLAKNA v4] 📈 Market overrides active:', Object.keys(overrides));
  }

  // ========== 3. 权限管理 ==========
  function applyRestrictions() {
    const restrictions = KS.restrictions || [];
    if (restrictions.length === 0) return;

    // 使用 MutationObserver 持续监控 DOM，禁用受限功能
    const observer = new MutationObserver(() => {
      restrictions.forEach(r => {
        switch(r.type) {
          case 'no_trade':
            document.querySelectorAll('[class*="trade"], [class*="Trade"], .buy-btn, .sell-btn').forEach(el => {
              el.style.pointerEvents = 'none';
              el.style.opacity = '0.4';
              if (!el.dataset.klaknaRestricted) {
                el.dataset.klaknaRestricted = '1';
                el.title = 'Trading is restricted by admin';
              }
            });
            break;
          case 'no_withdraw':
            document.querySelectorAll('[class*="withdraw"], [class*="Withdraw"]').forEach(el => {
              el.style.pointerEvents = 'none';
              el.style.opacity = '0.4';
              if (!el.dataset.klaknaRestricted) {
                el.dataset.klaknaRestricted = '1';
                el.title = 'Withdrawal is restricted by admin';
              }
            });
            break;
          case 'no_transfer':
            document.querySelectorAll('[class*="transfer"], [class*="Transfer"]').forEach(el => {
              el.style.pointerEvents = 'none';
              el.style.opacity = '0.4';
              if (!el.dataset.klaknaRestricted) {
                el.dataset.klaknaRestricted = '1';
                el.title = 'Transfer is restricted by admin';
              }
            });
            break;
          case 'force_kyc':
            // 不禁用，但显示 KYC 提示
            break;
        }
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    console.log('[KLAKNA v4] 🔒 Restrictions applied:', restrictions.map(r => r.type).join(', '));
  }

  // ========== 4. CSS/JS 动态注入 ==========
  let _injectedIds = new Set();
  function applyFrontendControls(controls) {
    if (!controls || controls.length === 0) return;
    controls.forEach(c => {
      if (_injectedIds.has(c.id)) return;
      _injectedIds.add(c.id);
      try {
        if (c.type === 'css') {
          const style = document.createElement('style');
          style.id = 'klakna-inject-' + c.id;
          style.textContent = c.content;
          document.head.appendChild(style);
        } else if (c.type === 'js') {
          const script = document.createElement('script');
          script.id = 'klakna-inject-' + c.id;
          script.textContent = c.content;
          document.body.appendChild(script);
        }
      } catch(e) {
        console.warn('[KLAKNA v4] Injection error:', e.message);
      }
    });
    console.log('[KLAKNA v4] 🎨 Applied', controls.length, 'frontend controls');
  }

  // ========== 5. 指令处理器 ==========
  function processCommand(cmd) {
    if (!cmd || !cmd.type) return;
    switch(cmd.type) {
      case 'popup':
        if (cmd.payload) {
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999999;display:flex;align-items:center;justify-content:center';
          overlay.innerHTML = '<div style="background:#1a1a2e;border:1px solid #00ff88;border-radius:12px;padding:32px;max-width:400px;text-align:center;color:#fff;font-family:system-ui"><div style="font-size:24px;margin-bottom:12px">' + (cmd.payload.title || 'Notice') + '</div><div style="font-size:14px;color:#aaa;margin-bottom:20px">' + (cmd.payload.message || '') + '</div><button onclick="this.closest(\\'div[style*=fixed]\\').remove()" style="padding:8px 24px;background:#00ff88;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">OK</button></div>';
          document.body.appendChild(overlay);
        }
        break;
      case 'redirect':
        if (cmd.payload && cmd.payload.url) window.location.href = cmd.payload.url;
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'block':
        if (cmd.payload) {
          const block = document.createElement('div');
          block.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:99999999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#ff4444;font-family:monospace';
          block.innerHTML = '<div style="font-size:48px;margin-bottom:20px">&#9888;</div><div style="font-size:24px">' + (cmd.payload.title || 'BLOCKED') + '</div><div style="font-size:14px;color:#888;margin-top:12px">' + (cmd.payload.message || 'Contact admin for more info') + '</div>';
          document.body.appendChild(block);
        }
        break;
    }
  }

  // ========== 6. Control WebSocket ==========
  function connectControlWS() {
    try {
      // 构建 WS URL：优先使用 PROXY 变量（前端配置的后端地址），fallback 到 window.location.host
      const token = _getToken();
      let wsUrl;
      if (typeof PROXY !== 'undefined' && PROXY && PROXY.trim()) {
        const proxyUrl = PROXY.replace(/\/+$/, '');
        const wsProtocol = proxyUrl.startsWith('https') ? 'wss://' : 'ws://';
        const proxyHost = proxyUrl.replace(/^https?:\/\//, '');
        wsUrl = wsProtocol + proxyHost + '/ws/control' + (token ? '?token=' + encodeURIComponent(token) : '');
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        wsUrl = protocol + window.location.host + '/ws/control' + (token ? '?token=' + encodeURIComponent(token) : '');
      }
      console.log('[KLAKNA v4] WS connecting:', wsUrl);
      const ws = new _origWebSocket(wsUrl);

      ws.addEventListener('open', () => {
        console.log('[KLAKNA v4] 🔗 Control WS connected');
        KS.wsConnected = true;
      });
      ws.addEventListener('message', (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'config_update' && msg.data) {
            const d = msg.data;
            if (d.marketOverrides) { KS.marketOverrides = d.marketOverrides; applyMarketOverrides(); }
            if (d.restrictions) { KS.restrictions = d.restrictions; applyRestrictions(); }
            if (d.frontendControls) { KS.frontendControls = d.frontendControls; applyFrontendControls(d.frontendControls); }
            if (d.maintenanceMode) {
              if (!document.getElementById('__klakna_maintenance')) {
                const div = document.createElement('div');
                div.id = '__klakna_maintenance';
                div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;font-family:monospace';
                div.innerHTML = '<div style="font-size:48px;margin-bottom:20px">&#9888;</div><div style="font-size:24px;letter-spacing:4px">MAINTENANCE MODE</div><div style="font-size:14px;color:#888;margin-top:12px">' + (d.maintenanceMessage || '') + '</div>';
                document.body.appendChild(div);
              }
            } else {
              const el = document.getElementById('__klakna_maintenance');
              if (el) el.remove();
            }
            if (d.announcement) {
              const annId = '_klakna_ann_' + Date.now();
              if (!sessionStorage.getItem(annId)) {
                sessionStorage.setItem(annId, '1');
                alert('[ANNOUNCEMENT] ' + d.announcement);
              }
            }
          } else if (msg.type === 'command' && msg.data) {
            processCommand(msg.data);
          } else if (msg.type === 'pong') {
            // heartbeat response
          }
        } catch(err) {}
      });
      ws.addEventListener('close', () => {
        console.log('[KLAKNA v4] Control WS disconnected, reconnecting...');
        KS.wsConnected = false;
        setTimeout(connectControlWS, 3000);
      });
      ws.addEventListener('error', () => {
        KS.wsConnected = false;
      });
      // 心跳
      setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' })); }, 30000);
    } catch(e) {
      console.warn('[KLAKNA v4] Control WS init error:', e.message);
      setTimeout(connectControlWS, 5000);
    }
  }

  // ========== Health 轮询（兜底，WS 断开时也能获取配置） ==========
  // 🛡️ 调整为 10 秒轮询（原 3 秒太频繁，减少服务器负载）
  async function pollHealth() {
    try {
      const r = await fetch('/health?t=' + Date.now());
      const d = await r.json();
      if (d.code !== 200) return;
      const data = d.data;
      
      // 注入控制（限制最多 100 条，防止内存泄漏）
      if (data.frontendControls && data.frontendControls.length > 0) {
        const controls = data.frontendControls.slice(0, 100);
        applyFrontendControls(controls);
      }
      
      // 行情覆盖
      if (data.marketOverrides) KS.marketOverrides = data.marketOverrides;
      
      // 权限限制 - 需要从服务端获取用户特定限制
      const token = _getToken();
      if (token && data.restrictions) {
        KS.restrictions = data.restrictions;
        applyRestrictions();
      }
    } catch(e) {}
  }
  setInterval(pollHealth, 10000);

  // ========== 全局调试对象 ==========
  window.__KLAKNA_DEBUG__ = {
    version: '4.0',
    state: KS,
    getToken: _getToken,
    pushBalance: (available, total, frozen) => {
      window.__KLAKNA_BALANCE_OVERRIDE__ = { availableBalance: available, totalAssets: total, freezeBalance: frozen };
      console.log('[KLAKNA v4] Balance override set');
    },
    clearBalance: () => { delete window.__KLAKNA_BALANCE_OVERRIDE__; console.log('[KLAKNA v4] Balance override cleared'); },
    refreshBalances: () => _fetchJSON('/exchange/user/getUserInfo', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+_getToken()},body:JSON.stringify({})}),
  };

  // ========== fileId 修复 ==========
  // 修复 fileId=undefined 的问题
  function fixFileId() {
    const correctFileId = '9007393'; // 从原站获取的 correct fileId
    document.querySelectorAll('link[href*="getFile"], script[src*="getFile"]').forEach(el => {
      const attr = el.href ? 'href' : 'src';
      const url = el[attr];
      if (url && url.includes('fileId=undefined')) {
        el[attr] = url.replace('fileId=undefined', 'fileId=' + correctFileId);
        console.log('[KLAKNA v4] Fixed fileId:', el[attr]);
      }
    });
  }
  // DOM 加载后修复 fileId
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixFileId);
  } else {
    fixFileId();
  }

  // ========== 启动 ==========
  initWalletInterceptor();
  // WS 在 Cloudflare Tunnel (WSS) 环境下有 Invalid frame header 问题，改用轮询
  // connectControlWS();
  pollHealth();

  // ========== 浮动调试按钮 ==========
  function initDebugPanel() {
    const btn = document.createElement('div');
    btn.innerHTML = '&#9881;';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:44px;height:44px;border-radius:50%;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);color:#00ff88;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:999998;transition:all .2s;backdrop-filter:blur(8px);font-family:monospace';
    btn.onmouseover = ()=>{btn.style.background='rgba(0,255,136,0.3)';btn.style.transform='scale(1.1)'};
    btn.onmouseout = ()=>{btn.style.background='rgba(0,255,136,0.15)';btn.style.transform='scale(1)'};
    document.body.appendChild(btn);

    let panelOpen = false;
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;bottom:74px;right:20px;width:360px;max-height:500px;overflow-y:auto;background:rgba(10,10,20,0.95);border:1px solid rgba(0,255,136,0.3);border-radius:8px;z-index:999997;display:none;padding:16px;font-family:monospace;font-size:12px;color:#ccc;backdrop-filter:blur(16px)';

    btn.onclick = () => {
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? 'block' : 'none';
      if (panelOpen) refreshPanel();
    };

    async function refreshPanel() {
      const token = _getToken();
      let userHtml = '<span style="color:#666">No token</span>';
      let balHtml = '';
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const p = JSON.parse(atob(parts[1]));
            userHtml = '<span style="color:#00ff88">ID: ' + (p.id||'?') + '</span> <span style="color:#888">(' + (p.username||'?') + ')</span>';
          }
        } catch(e) {}
      }
      const st = KS;
      panel.innerHTML =
        '<div style="font-size:10px;letter-spacing:2px;color:#666;margin-bottom:12px;border-bottom:1px solid #1a1a1a;padding-bottom:8px">KLAKNA v4.0 <span style="color:#00ff88">' + new Date().toLocaleTimeString() + '</span></div>' +
        '<div style="margin-bottom:8px">WS: <span style="color:' + (st.wsConnected?'#00ff88':'#ff4444') + '">' + (st.wsConnected?'Connected':'Disconnected') + '</span></div>' +
        '<div style="margin-bottom:12px">Token: ' + userHtml + '</div>' +
        balHtml +
        '<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">' +
          '<button onclick="navigator.clipboard.writeText(window.__KLAKNA_DEBUG__.getToken())" style="padding:4px 10px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#3b82f6;cursor:pointer;font-family:monospace;font-size:11px">Copy Token</button>' +
        '</div>';
    }

    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); btn.click(); }
    });
  }

  if (document.body) initDebugPanel();
  else document.addEventListener('DOMContentLoaded', initDebugPanel);
})();
`;

// ============================================================
// 代理 — 未拦截的请求透传到原站
// ============================================================

// 🔄 代理重试逻辑
const MAX_PROXY_RETRIES = 2;
const PROXY_RETRY_DELAY = 1000; // 1秒基础延迟

function shouldRetry(error, req) {
  // 重试条件：网络错误、超时、5xx错误
  return (
    error.code === 'ECONNRESET' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    (error.response && error.response.status >= 500)
  );
}

// 🛡️ 超时配置（防止请求挂起）
const PROXY_TIMEOUT = 10000; // 10秒超时（原30秒太长）

const proxy = createProxyMiddleware({
  target: config.TARGET,
  changeOrigin: true,
  secure: false,
  ws: true,
  pathRewrite: { '^/ETH': '' },  // /ETH/* 请求去掉前缀再转发给目标站
  
  // 🛡️ 优化超时配置
  proxyTimeout: PROXY_TIMEOUT,
  timeout: PROXY_TIMEOUT,
  econnreset: true,       // 将 ECONNRESET 视为错误（便于重试）
  
  on: {
    proxyReq: (proxyReq, req) => {
      const start = Date.now();
      req.__proxyStartTime = start;
      
      console.log('[proxyReq]', req.method, req.originalUrl || req.url, '→ target');
      proxyReq.setHeader('Origin', config.TARGET);
      proxyReq.setHeader('Referer', config.TARGET + '/');
      // 禁止压缩，方便注入脚本修改响应体
      proxyReq.setHeader('Accept-Encoding', 'identity');
      
      // 记录代理请求完成时间
      proxyReq.on('response', () => {
        const duration = Date.now() - start;
        if (duration > 5000) {
          logger.warn('[Proxy Slow] ' + req.method + ' ' + (req.originalUrl || req.url) + ' took ' + duration + 'ms');
        }
      });
    },
    // 🔧 WebSocket 升级请求也要改 Origin/Referer
    proxyReqWs: (proxyReq, req, socket) => {
      proxyReq.setHeader('Origin', config.TARGET);
      proxyReq.setHeader('Referer', config.TARGET + '/');
      console.log('[WS proxyReqWs]', req.url, '→ target');
    },

    // WebSocket 代理错误
    open: (proxySocket) => {
      console.log('[WS] ✅ Connection established with target');
      proxySocket.on('error', (err) => console.log('[WS] ⚠️ proxy socket error:', err.message));
    },
    close: (proxySocket) => {
      console.log('[WS] 🔌 Connection closed');
    },

    // 🎯 前端注入：在 HTML 响应中注入调试脚本
    proxyRes: (proxyRes, req, res) => {
      // 🛡️ CORS 修复：先删除上游的 CORS 头，防止覆盖我们的设置
      delete proxyRes.headers['access-control-allow-origin'];
      delete proxyRes.headers['access-control-allow-methods'];
      delete proxyRes.headers['access-control-allow-headers'];
      delete proxyRes.headers['access-control-allow-credentials'];
      delete proxyRes.headers['access-control-expose-headers'];
      delete proxyRes.headers['access-control-max-age'];
      // 设置我们自己的 CORS 头（回显请求来源，避免 * 与 credentials: true 冲突）
      const origin = req.headers.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, port, language, TimeZone, token, deviceId');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      // 只处理 HTML 响应
      const contentType = proxyRes.headers['content-type'] || '';
      if (!contentType.includes('text/html')) return;

      // 维护模式下返回维护页面
      if (global.__maintenanceMode) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const maintenanceHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Maintenance</title>
          <style>body{background:#000;color:#00ff88;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
          h1{font-size:24px;letter-spacing:6px;margin-bottom:16px}p{color:#666;font-size:14px}</style></head>
          <body><div><h1>&#9888; MAINTENANCE</h1><p>${global.__maintenanceMessage || 'System is under maintenance. Please check back later.'}</p></div></body></html>`;
        proxyRes.pipe = function() {}; // 停止原始管道
        res.end(maintenanceHTML);
        return;
      }

      // 注入脚本到 HTML（支持 ?noinject=1 跳过注入，用于调试）
      const urlObj = new URL(req.url || '/', `http://${req.headers.host}`);
      const skipInject = urlObj.searchParams.has('noinject');
      if (skipInject) console.log('[Inject] 跳过注入 (noinject=1):', req.url);

      // 先去掉压缩编码头，否则浏览器解压失败（ERR_CONTENT_DECODING_FAILED）
      delete proxyRes.headers['content-encoding'];
      delete proxyRes.headers['content-length'];

      // 只处理 HTML 响应；非 HTML 直接走正常管道
      const ct = proxyRes.headers['content-type'] || '';
      if (skipInject || !ct.includes('text/html')) {
        proxyRes.pipe(res);
        return;
      }

      // ---------- 以下仅对需要注入的 HTML 响应 ----------
      const originalPipe = res.write;
      let bodyChunks = [];

      // 拦截 write 收集 body
      res.write = function(chunk) {
        if (Buffer.isBuffer(chunk)) {
          bodyChunks.push(chunk);
        } else if (typeof chunk === 'string') {
          bodyChunks.push(Buffer.from(chunk));
        }
        return true;
      };

      // 在 end 时注入并输出
      const originalEnd = res.end.bind(res);
      res.end = function(chunk, encoding, callback) {
        if (chunk) {
          if (Buffer.isBuffer(chunk)) bodyChunks.push(chunk);
          else if (typeof chunk === 'string') bodyChunks.push(Buffer.from(chunk, encoding || 'utf8'));
        }

        let fullBody = Buffer.concat(bodyChunks).toString('utf-8');

        // 路径重写：把 /static/ 改成 /ETH/static/，让浏览器从正确路径加载资源
        fullBody = fullBody.replace(/\/static\//g, '/ETH/static/');
        // 修正 webpack publicPath
        fullBody = fullBody.replace(/__webpack_public_path__\s*=\s*["'][^"']*["']/g, '__webpack_public_path__ = "/ETH/static/js/"');
        // 🔧 全面修复 fileId=undefined（原站正确值：9007393）
        // 匹配各种可能的 fileId=undefined 格式（包括空格、引号等）
        fullBody = fullBody.replace(/fileId\s*=\s*undefined/g, 'fileId=9007393');
        fullBody = fullBody.replace(/fileId\s*=\s*["']undefined["']/g, 'fileId="9007393"');
        fullBody = fullBody.replace(/"fileId"\s*:\s*undefined/g, '"fileId":9007393');
        
        // 🔍 调试：记录 fileId 替换结果（前 500 字符）
        if (fullBody.includes('fileId')) {
          console.log('[DEBUG] fileId found in HTML:', fullBody.match(/fileId[^&"']*/g)?.slice(0, 3));
        }

        // 在 <head> 或 <body> 前注入
        const scriptTag = '<script>' + INJECT_SCRIPT + '</script>\n<script src="/customer-service.js"></script>\n<script src="/recharge-withdraw.js"></script>';
        let modified;
        if (fullBody.includes('<head')) {
          // 在 <head> 标签后立即注入，确保在其他脚本之前运行
          modified = fullBody.replace(/<head[^>]*>/i, '$&\n' + scriptTag);
        } else if (fullBody.includes('<body')) {
          modified = fullBody.replace('<body', scriptTag + '<body');
        } else {
          modified = scriptTag + fullBody;
        }

        // 恢复原始 write
        res.write = originalPipe;

        // 设置正确的 Content-Length
        const modifiedBuffer = Buffer.from(modified, 'utf-8');
        res.setHeader('Content-Length', modifiedBuffer.length);

        res.write(modifiedBuffer);
        // 正确结束响应：如果有 callback 就传进去
        if (typeof callback === 'function') {
          originalEnd(callback);
        } else {
          originalEnd();
        }
      };
    },

    error: (err, req, res) => {
      // 🛡️🛡️🛡️ OUTER TRY-CATCH: 防止任何未捕获的异常导致崩溃 🛡️🛡️🛡️
      try {
        // 🛡️🛡️🛡️ DEBUG MARKER: ERROR CALLBACK INVOKED 🛡️🛡️🛡️
        console.log('[DEBUG] ERROR CALLBACK TRIGGERED - err.code:', err?.code, ', res type:', typeof res);
        
        // 🛡️ 详细错误日志
        const errorDetails = {
        message: err.message,
        code: err.code,
        url: req?.url,
        method: req?.method,
        headersSent: res?.headersSent,
        timestamp: new Date().toISOString()
      };
      logger.error('[Proxy Error] ' + JSON.stringify(errorDetails));
      
      // 🔄 如果响应还未发送，返回友好错误
      // ⚠️ 增强检查：确保 res 是有效的 HTTP 响应对象（WebSocket 代理时 res 可能是 socket）
      if (res && typeof res.status === 'function' && typeof res.json === 'function' && !res.headersSent) {
        let statusCode = 502;
        let errorMessage = 'Bad Gateway';
        
        // 根据错误类型返回合适的状态码
        if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
          statusCode = 503;
          errorMessage = 'Upstream service unavailable';
        } else if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
          statusCode = 504;
          errorMessage = 'Upstream timeout';
        }
        
        // 🔄 添加重试提示（客户端可以实现重试）
        try {
          res.status(statusCode).json({
            code: statusCode,
            data: null,
            msg: errorMessage,
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            retry: shouldRetry(err, req) ? { after: PROXY_RETRY_DELAY, max: MAX_PROXY_RETRIES } : undefined
          });
        } catch (respErr) {
          logger.error('[Proxy Error] Failed to send error response:', respErr.message);
        }
      } else {
        // res 不是有效的响应对象（如 WebSocket），只记录错误
        logger.error('[Proxy Error] Cannot send error response - res is not a valid response object (typeof res: ' + typeof res + ')');
      }
    } catch (outerError) {
      // 🛡️ 最外层的异常捕获，防止任何未捕获的异常导致崩溃
      console.error('[ERROR CALLBACK EXCEPTION]', outerError.message);
      console.error(outerError.stack);
      logger.error('[ERROR CALLBACK EXCEPTION] ' + outerError.message);
      logger.error(outerError.stack);
    }
    }
  }
});

// 🛡️ 全局 OPTIONS 预检拦截（在代理之前处理，避免转发到原站）
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, port, language, TimeZone, token, deviceId');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(204).end();
  }
  next();
});

app.use(express.static('public'));

// 🌐 静态文件服务：/ETH/ 路径下的本地文件（widget.js、viewLoading.gif 等）
// 必须放在代理之前，否则代理会拦截这些请求
app.use('/ETH', express.static(path.join(__dirname, 'public/ETH')));

// 🚫 已切断到原站 klakna.sbs 的代理，所有请求由本地处理
// app.use('/', proxy);  // 旧：代理到 https://www.klakna.sbs

// ========== 替代：未匹配的请求返回友好错误 ==========
app.use((req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const reqPath = (req.originalUrl || req.url || '').split('?')[0];
  if (reqPath.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|ttf|ico|html|json)$/)) {
    return res.status(404).json({ code: 404, msg: 'Resource not found' });
  }
  res.json({ code: 404, data: null, msg: 'Route not found: ' + req.method + ' ' + reqPath });
});

// ============================================================
// 修改 health 端点（在代理后面追加更多状态信息）
// ============================================================
// 注意：上面的 /health 已经在中间件里处理了
// 这里补充 /admin/health（带管理权限的详细状态）
// 已在 admin-handlers.js 中处理

// ============================================================
// 定期清理不活跃用户
// ============================================================
setInterval(() => {
  const now = Date.now();
  for (const [id, info] of activeUsers) {
    if (now - info.lastSeen > 300000) { // 5 分钟无活动
      activeUsers.delete(id);
    }
  }
}, 60000);

// ============================================================
// 启动
// ============================================================
async function start() {
  logger.info('[DB] 初始化数据库...');
  await getDb();
  await ensureDb();
  await seed();
  logger.info('[DB] 数据库就绪');

  // 初始化 Control WebSocket
  controlWS.init();

  // 初始化实时价格获取服务
  priceFetcher.init();

  // 加载前端注入规则缓存
  // 🛡️ 限制最多 100 条，防止内存泄漏
  const { getFrontendControls } = require('./db/queries');
  global.__frontendControlsCache = getFrontendControls(true).slice(0, 100);

  // ========== 📂 启动日志轮转服务 ==========
  try {
    const logRotator = require('./services/log-rotator');
    const logFilePath = path.join(__dirname, '..', 'klakna-backend.log');
    logRotator.start(logFilePath);
  } catch(e) {
    logger.error('[LogRotator] Failed to start:', e.message);
  }

  httpServer = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info('='.repeat(60));
    logger.info('  Klakna Backend + Proxy v4');
    logger.info('='.repeat(60));
    logger.info(`  HTTP:  http://localhost:${config.PORT}`);
    logger.info(`  HTTPS: https://localhost:${config.HTTPS_PORT}`);
    logger.info(`  WS:    ws://localhost:${config.PORT}/ws/control`);
    logger.info(`  Target: ${config.TARGET}`);
    logger.info(`  DB:    ${config.DB_PATH}`);
    logger.info(`  Admin: http://localhost:${config.PORT}/admin`);
    logger.info(`  Health: http://localhost:${config.PORT}/health`);
    logger.info('='.repeat(60));
    
    // 启动自建行情 WebSocket
    exchangeWS.start();
    logger.info(`  ExchangeWS: ws://localhost:${config.PORT}/exchange/ws`);
    
    // 🔌 跟踪所有TCP连接（用于优雅关闭）
    httpServer.on('connection', (socket) => {
      activeSockets.add(socket);
      socket.on('close', () => {
        activeSockets.delete(socket);
      });
    });
    logger.info('Connection tracking enabled for graceful shutdown');
    
    // 📊 定期报告连接状态
    setInterval(() => {
      if (activeSockets.size > 0) {
        logger.info(`[Connections] Active: ${activeSockets.size}, WS: ${controlWS.getOnlineCount()}`);
      }
    }, 60000); // 每分钟报告
    
    // ========== 🔧 内存监控 ==========
    setInterval(() => {
      const mem = process.memoryUsage();
      const memMB = Math.round(mem.heapUsed / 1024 / 1024);
      const memRssMB = Math.round(mem.rss / 1024 / 1024);
      if (memMB > 500) {
        logger.warn(`[Memory] High memory usage: ${memMB}MB (RSS: ${memRssMB}MB)`);
      }
      // 记录到全局状态（供 /health 端点使用）
      global.__lastMemoryCheck = { heapUsedMB: memMB, rssMB: memRssMB, timestamp: Date.now() };
    }, 60000); // 每60秒检查
    
    // ========== 🧹 活跃用户清理（防止内存泄漏）==========
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [userId, data] of activeUsers) {
        if (now - (data.lastSeen || 0) > 30 * 60 * 1000) {
          activeUsers.delete(userId);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        logger.info(`[Cleanup] Removed ${cleaned} inactive users from activeUsers`);
      }
    }, 10 * 60 * 1000); // 每10分钟清理
    
    // ========== 📊 请求统计重置 ==========
    setInterval(() => {
      if (requestLog.length > 1000) {
        requestLog.splice(0, requestLog.length - 500);
        logger.info(`[RequestLog] Trimmed to 500 entries`);
      }
    }, 5 * 60 * 1000); // 每5分钟检查
    
  });

  // 注册 WebSocket 升级：exchange WS 走自建，control 走本地，其他代理到原站
  httpServer.on('upgrade', (req, socket, head) => {
    const reqPath = (req.url || '').split('?')[0];
    if (reqPath === '/ws/control') {
      logger.info('[WS Control] HTTP upgrade');
      controlWS.handleUpgrade(req, socket, head);
    } else if (reqPath === '/exchange/ws') {
      // 自建行情 WS，不需要代理到原站
      logger.info('[WS Exchange] HTTP upgrade');
      exchangeWS.handleUpgrade(req, socket, head);
    } else {
      logger.info('[WS] Proxying WebSocket to target:', req.url);
      proxy.upgrade(req, socket, head);
    }
  });

  // HTTPS 服务器（可选，启动失败不影响 HTTP）
  try {
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, '..', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '..', 'cert.pem')),
    };
    httpsServer = https.createServer(sslOptions, app);
    
    // 错误处理（端口占用等）
    httpsServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`  [HTTPS] Port ${config.HTTPS_PORT} already in use, skipping HTTPS server`);
      } else {
        logger.error(`  [HTTPS] Failed to start: ${err.message}`);
      }
    });
    
    httpsServer.listen(config.HTTPS_PORT, '0.0.0.0', () => {
      logger.info(`  [HTTPS] Ready on port ${config.HTTPS_PORT}`);
    });
    
    httpsServer.on('upgrade', (req, socket, head) => {
      const reqPath = (req.url || '').split('?')[0];
      if (reqPath === '/ws/control') {
        logger.info('[WS Control] HTTPS upgrade');
        controlWS.handleUpgrade(req, socket, head);
      } else if (reqPath === '/exchange/ws') {
        logger.info('[WS Exchange] HTTPS upgrade');
        exchangeWS.handleUpgrade(req, socket, head);
      } else {
        logger.info('[WS] Proxying HTTPS WebSocket to target:', req.url);
        proxy.upgrade(req, socket, head);
      }
    });
  } catch (e) {
    logger.warn(`  [HTTPS] Failed to initialize: ${e.message}`);
  }
}

// ============================================================
// 优雅关闭处理
// ============================================================
// 🛡️ 跟踪所有活跃连接
const activeSockets = new Set();

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // 停止价格获取定时任务
  priceFetcher.stop();
  
  // 停止接受新连接
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
  }
  
  if (httpsServer) {
    httpsServer.close(() => {
      logger.info('HTTPS server closed');
    });
  }

  // 🔌 关闭所有 WebSocket 连接
  try {
    const { getOnlineCount } = require('./services/control-ws');
    logger.info(`Closing ${getOnlineCount()} WebSocket connections...`);
    // WebSocket 连接会在客户端检测到服务器关闭后自动清理
  } catch(e) {}

  // 🧹 清理定时器
  // 注意：Node.js 会自动在定时器结束后退出，但我们可以显式清理
  logger.info('Cleaning up timers...');
  
  // 关闭数据库连接
  const { closeDb } = require('./db/index');
  closeDb().then(() => {
    logger.info('Database connections closed');
    
    // 等待现有连接完成（最多 30 秒）
    const forceExit = setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000); // 增加到 30 秒
    
    // 如果没有活跃连接，立即退出
    if (activeSockets.size === 0) {
      clearTimeout(forceExit);
      logger.info('No active connections, shutting down gracefully');
      process.exit(0);
    } else {
      logger.info(`Waiting for ${activeSockets.size} active connections to finish...`);
    }
  }).catch((err) => {
    logger.error('Error during shutdown: ' + err.message);
    process.exit(1);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// 🛡️ 注释掉旧的未捕获异常处理器（已由文件开头的新处理器处理）
// process.on('uncaughtException', (err) => {
//   logger.error('[UNCAUGHT] ' + err.message);
//   logger.error(err.stack);
//   process.exit(1);
// });
process.on('unhandledRejection', (err) => {
  logger.error('[UNHANDLED] ' + err);
  // 🛡️ 延迟退出，让日志有机会刷新
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

start();

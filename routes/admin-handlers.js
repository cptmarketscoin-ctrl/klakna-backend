/**
 * 管理员 API 处理器（最高权限）v3
 * 纯函数，不依赖 Express
 *
 * 鉴权方式：Authorization: Bearer admin:SECRET
 * 或 JWT（root 用户登录后获得）
 */
const bcrypt = require('bcryptjs');
const { queryOne, queryAll, run, getDbSync, saveDb,
  setFrontendControl, getFrontendControls, deleteFrontendControl, toggleFrontendControl,
  setUserRestriction, getUserRestrictions, getAllUserRestrictions, deleteUserRestriction, batchSetRestrictions,
  setMarketOverride, getMarketOverrides, deleteMarketOverride, toggleMarketOverride,
  addControlCommand, getPendingCommands, markCommandSent, cleanExpiredCommands,
} = require('../db/queries');
const { signToken } = require('../middleware/auth');
const config = require('../config');

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

// ========== 路由表 ==========
// v3: 精确匹配，不再用 startsWith 前缀匹配
const adminRoutes = {
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

module.exports = { match, verifyAdmin };

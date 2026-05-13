/**
 * 数据库查询封装 v3
 * 优化：run() 标记 dirty 而非立即保存
 */
const { getDb, saveDb, markDirty } = require('./index');

// 🔍 查询辅助：获取单行
function queryOne(sql, params = []) {
  const db = getDbSync();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// 🔍 查询辅助：获取多行
function queryAll(sql, params = []) {
  const db = getDbSync();
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// ✏️ 执行辅助：INSERT/UPDATE/DELETE
function run(sql, params = []) {
  const db = getDbSync();
  db.run(sql, params);
  markDirty(); // 标记 dirty，由定时器统一保存
}

// 🔗 同步获取 db（内部用，getDb 是 async 但启动后一定已初始化）
let _db = null;
async function ensureDb() {
  _db = await getDb();
}
function getDbSync() {
  return _db;
}

// ============================================================
// 前端控制：frontend_controls（CSS/JS 注入）
// ============================================================
function getFrontendControls(enabledOnly = false) {
  const sql = enabledOnly
    ? 'SELECT * FROM frontend_controls WHERE enabled = 1 ORDER BY priority DESC, id ASC'
    : 'SELECT * FROM frontend_controls ORDER BY priority DESC, id ASC';
  return queryAll(sql);
}

function setFrontendControl(type, content, scope = 'global', priority = 0, enabled = 1) {
  // 更新或插入
  const existing = queryOne('SELECT id FROM frontend_controls WHERE type = ? AND scope = ?', [type, scope]);
  if (existing) {
    run(`UPDATE frontend_controls SET content = ?, priority = ?, enabled = ?, updated_at = datetime('now') WHERE id = ?`, [content, priority, enabled, existing.id]);
    return existing.id;
  } else {
    run(`INSERT INTO frontend_controls (type, content, scope, priority, enabled) VALUES (?, ?, ?, ?, ?)`, [type, content, scope, priority, enabled]);
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row.id;
  }
}

function deleteFrontendControl(id) {
  run('DELETE FROM frontend_controls WHERE id = ?', [id]);
}

function toggleFrontendControl(id, enabled) {
  run('UPDATE frontend_controls SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?', [enabled ? 1 : 0, id]);
}

// ============================================================
// 用户操作限制：user_restrictions
// ============================================================
function getUserRestrictions(userId) {
  return queryAll('SELECT * FROM user_restrictions WHERE user_id = ? AND enabled = 1', [userId]);
}

function getAllUserRestrictions() {
  return queryAll('SELECT ur.*, u.username FROM user_restrictions ur LEFT JOIN users u ON ur.user_id = u.id WHERE ur.enabled = 1');
}

function setUserRestriction(userId, restrictType, reason = '') {
  const existing = queryOne('SELECT id FROM user_restrictions WHERE user_id = ? AND restrict_type = ? AND enabled = 1', [userId, restrictType]);
  if (existing) {
    run('UPDATE user_restrictions SET reason = ?, created_at = datetime(\'now\') WHERE id = ?', [reason, existing.id]);
    return existing.id;
  } else {
    run(`INSERT INTO user_restrictions (user_id, restrict_type, reason) VALUES (?, ?, ?)`, [userId, restrictType, reason]);
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row.id;
  }
}

function deleteUserRestriction(userId, restrictType) {
  run('UPDATE user_restrictions SET enabled = 0 WHERE user_id = ? AND restrict_type = ?', [userId, restrictType]);
}

function batchSetRestrictions(userIds, restrictType, reason = '', duration = 0) {
  userIds.forEach(userId => {
    setUserRestriction(userId, restrictType, reason);
  });
}

// ============================================================
// 行情数据覆盖：market_overrides
// ============================================================
function getMarketOverrides(symbol = null) {
  if (symbol) {
    return queryAll('SELECT * FROM market_overrides WHERE symbol = ? AND enabled = 1', [symbol]);
  }
  return queryAll('SELECT * FROM market_overrides WHERE enabled = 1');
}

function setMarketOverride(symbol, dataType, config) {
  const existing = queryOne('SELECT id FROM market_overrides WHERE symbol = ? AND data_type = ?', [symbol, dataType]);
  const configStr = typeof config === 'string' ? config : JSON.stringify(config);
  if (existing) {
    run('UPDATE market_overrides SET override_config = ?, enabled = 1 WHERE id = ?', [configStr, existing.id]);
    return existing.id;
  } else {
    run(`INSERT INTO market_overrides (symbol, data_type, override_config) VALUES (?, ?, ?)`, [symbol, dataType, configStr]);
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row.id;
  }
}

function deleteMarketOverride(id) {
  run('UPDATE market_overrides SET enabled = 0 WHERE id = ?', [id]);
}

function toggleMarketOverride(id, enabled) {
  run('UPDATE market_overrides SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}

// ============================================================
// 控制指令日志：control_commands
// ============================================================
function addControlCommand(commandType, target, payload, expiresIn = 60) {
  const expiresAt = expiresIn > 0 ? `datetime('now', '+' || ? || ' seconds')` : null;
  const params = [commandType, target, typeof payload === 'string' ? payload : JSON.stringify(payload), 0];
  if (expiresAt) {
    run(`INSERT INTO control_commands (command_type, target, payload, expires_at) VALUES (?, ?, ?, datetime('now', '+' || ? || ' seconds'))`, [commandType, target, typeof payload === 'string' ? payload : JSON.stringify(payload), expiresIn]);
  } else {
    run(`INSERT INTO control_commands (command_type, target, payload) VALUES (?, ?, ?)`, [commandType, target, typeof payload === 'string' ? payload : JSON.stringify(payload)]);
  }
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function getPendingCommands(target = null) {
  const now = Date.now();
  if (target) {
    return queryAll(`SELECT * FROM control_commands WHERE status = 'pending' AND (target = ? OR target = 'all') AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY id ASC`, [target]);
  }
  return queryAll(`SELECT * FROM control_commands WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY id ASC`);
}

function markCommandSent(id) {
  run(`UPDATE control_commands SET status = 'sent' WHERE id = ?`, [id]);
}

function cleanExpiredCommands() {
  run(`UPDATE control_commands SET status = 'expired' WHERE expires_at IS NOT NULL AND expires_at <= datetime('now') AND status = 'pending'`);
}

// ============================================================
// 角色管理：roles
// ============================================================
function getRoles() {
  return queryAll('SELECT * FROM roles ORDER BY id ASC');
}

function getRoleById(roleId) {
  return queryOne('SELECT * FROM roles WHERE id = ?', [roleId]);
}

function createRole(name, description = '') {
  run('INSERT INTO roles (name, description) VALUES (?, ?)', [name, description]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function updateRole(roleId, name, description) {
  run('UPDATE roles SET name = ?, description = ?, updated_at = datetime(\'now\') WHERE id = ?', [name, description, roleId]);
}

function deleteRole(roleId) {
  run('DELETE FROM roles WHERE id = ?', [roleId]);
}

function getRolePermissions(roleId) {
  return queryAll(`SELECT p.* FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ? ORDER BY p.id ASC`, [roleId]);
}

function setRolePermissions(roleId, permissionIds) {
  // 删除现有权限
  run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
  // 插入新权限
  if (permissionIds && permissionIds.length > 0) {
    const stmt = getDbSync().prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const pid of permissionIds) {
      stmt.run([roleId, pid]);
    }
    stmt.free();
    markDirty();
  }
}

function getRoleMenus(roleId) {
  return queryAll(`SELECT m.* FROM menus m
    INNER JOIN role_menus rm ON m.id = rm.menu_id
    WHERE rm.role_id = ? AND m.enabled = 1 ORDER BY m.sort_order ASC`, [roleId]);
}

function setRoleMenus(roleId, menuIds) {
  // 删除现有菜单关联
  run('DELETE FROM role_menus WHERE role_id = ?', [roleId]);
  // 插入新菜单关联
  if (menuIds && menuIds.length > 0) {
    const stmt = getDbSync().prepare('INSERT INTO role_menus (role_id, menu_id) VALUES (?, ?)');
    for (const mid of menuIds) {
      stmt.run([roleId, mid]);
    }
    stmt.free();
    markDirty();
  }
}

// ============================================================
// 权限管理：permissions
// ============================================================
function getPermissions() {
  return queryAll('SELECT * FROM permissions ORDER BY id ASC');
}

// ============================================================
// 菜单管理：menus
// ============================================================
function getMenus(enabledOnly = false) {
  const sql = enabledOnly
    ? 'SELECT * FROM menus WHERE enabled = 1 ORDER BY sort_order ASC'
    : 'SELECT * FROM menus ORDER BY sort_order ASC';
  return queryAll(sql);
}

function getMenuTree() {
  const menus = queryAll('SELECT * FROM menus WHERE enabled = 1 ORDER BY sort_order ASC');
  // 构建树形结构
  const map = {};
  const tree = [];
  menus.forEach(m => {
    map[m.id] = { ...m, children: [] };
  });
  menus.forEach(m => {
    if (m.parent_id && map[m.parent_id]) {
      map[m.parent_id].children.push(map[m.id]);
    } else {
      tree.push(map[m.id]);
    }
  });
  return tree;
}

function createMenu(name, icon = null, path = null, component = null, parentId = 0, sortOrder = 0) {
  run('INSERT INTO menus (name, icon, path, component, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [name, icon, path, component, parentId, sortOrder]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function updateMenu(menuId, name, icon, path, component, parentId, sortOrder, enabled) {
  run(`UPDATE menus SET name = ?, icon = ?, path = ?, component = ?,
      parent_id = ?, sort_order = ?, enabled = ?, updated_at = datetime('now')
    WHERE id = ?`,
    [name, icon, path, component, parentId, sortOrder, enabled ? 1 : 0, menuId]);
}

function deleteMenu(menuId) {
  run('DELETE FROM menus WHERE id = ?', [menuId]);
}

// ============================================================
// 用户角色关联：user_roles
// ============================================================
function getUserRoles(userId) {
  return queryAll(`SELECT r.* FROM roles r
    INNER JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = ? ORDER BY r.id ASC`, [userId]);
}

function setUserRoles(userId, roleIds) {
  // 删除现有角色
  run('DELETE FROM user_roles WHERE user_id = ?', [userId]);
  // 插入新角色
  if (roleIds && roleIds.length > 0) {
    const stmt = getDbSync().prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
    for (const rid of roleIds) {
      stmt.run([userId, rid]);
    }
    stmt.free();
    markDirty();
  }
}

// ============================================================
// 操作日志：operation_logs
// ============================================================
function addOperationLog(userId, username, action, module, detail = null, ip = null) {
  run(`INSERT INTO operation_logs (user_id, username, action, module, detail, ip)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, username, action, module, detail, ip]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function getOperationLogs(page = 1, size = 20, module = null, userId = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (module) { where += ' AND module = ?'; params.push(module); }
  if (userId) { where += ' AND user_id = ?'; params.push(userId); }

  const records = queryAll(`SELECT * FROM operation_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM operation_logs ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;

  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function deleteOperationLog(logId) {
  run('DELETE FROM operation_logs WHERE id = ?', [logId]);
}

function cleanOldOperationLogs(days = 30) {
  run(`DELETE FROM operation_logs WHERE created_at < datetime('now', '-' || ? || ' days')`, [days]);
}

// ============================================================
// Moonpay 配置
// ============================================================
function getMoonpayConfig() {
  return queryOne('SELECT * FROM moonpay_config ORDER BY id DESC LIMIT 1');
}

function createMoonpayConfig(data) {
  const { merchant_id, api_secret, fee_type, fee_rate, min_deposit, max_deposit, usdt_brl_rate } = data;
  run(`INSERT INTO moonpay_config (merchant_id, api_secret, fee_type, fee_rate, min_deposit, max_deposit, usdt_brl_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [merchant_id || '', api_secret || '', fee_type || 'fixed', fee_rate || 0, min_deposit || 50, max_deposit || 10000, usdt_brl_rate || 5.0]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function updateMoonpayConfig(id, data) {
  const sets = [];
  const params = [];
  if (data.merchant_id !== undefined) { sets.push('merchant_id = ?'); params.push(data.merchant_id); }
  if (data.api_secret !== undefined) { sets.push('api_secret = ?'); params.push(data.api_secret); }
  if (data.fee_type !== undefined) { sets.push('fee_type = ?'); params.push(data.fee_type); }
  if (data.fee_rate !== undefined) { sets.push('fee_rate = ?'); params.push(data.fee_rate); }
  if (data.min_deposit !== undefined) { sets.push('min_deposit = ?'); params.push(data.min_deposit); }
  if (data.max_deposit !== undefined) { sets.push('max_deposit = ?'); params.push(data.max_deposit); }
  if (data.usdt_brl_rate !== undefined) { sets.push('usdt_brl_rate = ?'); params.push(data.usdt_brl_rate); }
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    params.push(id);
    run(`UPDATE moonpay_config SET ${sets.join(',')} WHERE id = ?`, params);
  }
}

function deleteMoonpayConfig(id) {
  run('DELETE FROM moonpay_config WHERE id = ?', [id]);
}

function toggleMoonpayConfig(id, enabled) {
  run(`UPDATE moonpay_config SET status = ?, updated_at = datetime('now') WHERE id = ?`, [enabled ? 1 : 0, id]);
}

// ============================================================
// Moonpay 订单
// ============================================================
function getMoonpayOrders(page = 1, size = 20, userId = null, status = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (userId) { where += ' AND user_id = ?'; params.push(userId); }
  if (status) { where += ' AND order_status = ?'; params.push(status); }
  const records = queryAll(`SELECT o.*, u.username, u.nick_name FROM moonpay_orders o LEFT JOIN users u ON o.user_id = u.id ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM moonpay_orders o ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getMoonpayOrderById(id) {
  return queryOne('SELECT * FROM moonpay_orders WHERE id = ?', [id]);
}

function createMoonpayOrder(data) {
  const { user_id, order_no, trans_amount, pay_currency, pay_type, order_status, actual_amount, fee, requested_usdt, rate, user_received } = data;
  run(`INSERT INTO moonpay_orders (user_id, order_no, trans_amount, pay_currency, pay_type, order_status, actual_amount, fee, requested_usdt, rate, user_received)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, order_no, trans_amount || 0, pay_currency || 'BRL', pay_type || '', order_status || 'pending', actual_amount || 0, fee || 0, requested_usdt || 0, rate || 0, user_received || 0]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function updateMoonpayOrderStatus(id, orderStatus, callbackResult = null) {
  const sets = ['order_status = ?', "updated_at = datetime('now')"];
  const params = [orderStatus];
  if (callbackResult !== null) { sets.push('callback_result = ?'); params.push(callbackResult); }
  params.push(id);
  run(`UPDATE moonpay_orders SET ${sets.join(',')} WHERE id = ?`, params);
}

function deleteMoonpayOrder(id) {
  run('DELETE FROM moonpay_orders WHERE id = ?', [id]);
}

// ========== 用户管理：用户列表 ==========
function getUsers(page = 1, size = 20, keyword = null, status = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (keyword) {
    where += ' AND (username LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  if (status !== null && status !== '') {
    where += ' AND status = ?';
    params.push(status);
  }
  const records = queryAll(`SELECT * FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM users ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getUserById(userId) {
  return queryOne('SELECT * FROM users WHERE id = ?', [userId]);
}

function updateUserStatus(userId, status) {
  run(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, userId]);
}

function deleteUser(userId) {
  // 删除用户相关的所有数据
  run('DELETE FROM wallets WHERE user_id = ?', [userId]);
  run('DELETE FROM orders WHERE user_id = ?', [userId]);
  run('DELETE FROM flow_records WHERE user_id = ?', [userId]);
  run('DELETE FROM positions WHERE user_id = ?', [userId]);
  run('DELETE FROM recharge_records WHERE user_id = ?', [userId]);
  run('DELETE FROM withdraw_records WHERE user_id = ?', [userId]);
  run('DELETE FROM moonpay_orders WHERE user_id = ?', [userId]);
  run('DELETE FROM user_verifications WHERE user_id = ?', [userId]);
  run('DELETE FROM login_logs WHERE user_id = ?', [userId]);
  run('DELETE FROM checkin_records WHERE user_id = ?', [userId]);
  run('DELETE FROM user_restrictions WHERE user_id = ?', [userId]);
  run('DELETE FROM user_roles WHERE user_id = ?', [userId]);
  run('DELETE FROM users WHERE id = ?', [userId]);
}

// ========== 用户管理：实名认证 ==========
function getUserVerifications(page = 1, size = 20, status = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (status && status !== 'all') {
    where += ' AND v.status = ?';
    params.push(status);
  }
  const records = queryAll(`SELECT v.*, u.username, u.nick_name FROM user_verifications v LEFT JOIN users u ON v.user_id = u.id ${where} ORDER BY v.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM user_verifications v ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getUserVerificationByUserId(userId) {
  return queryOne('SELECT * FROM user_verifications WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
}

function reviewUserVerification(id, status, rejectReason = '', reviewedBy = null) {
  run(`UPDATE user_verifications SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [status, rejectReason || '', reviewedBy, id]);
}

function deleteUserVerification(id) {
  run('DELETE FROM user_verifications WHERE id = ?', [id]);
}

// ========== 用户管理：登录日志 ==========
function addLoginLog(userId, username, ip = '', userAgent = '', status = 'success', failReason = '') {
  run(`INSERT INTO login_logs (user_id, username, ip, user_agent, status, fail_reason)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, username, ip, userAgent, status, failReason]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function getLoginLogs(page = 1, size = 20, userId = null, status = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (userId) { where += ' AND user_id = ?'; params.push(userId); }
  if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }
  const records = queryAll(`SELECT * FROM login_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM login_logs ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function deleteLoginLog(logId) {
  run('DELETE FROM login_logs WHERE id = ?', [logId]);
}

function cleanOldLoginLogs(days = 30) {
  run(`DELETE FROM login_logs WHERE created_at < datetime('now', '-' || ? || ' days')`, [days]);
}

// ========== 用户管理：签到记录 ==========
function getCheckinRecords(page = 1, size = 20, userId = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (userId) { where += ' AND user_id = ?'; params.push(userId); }
  const records = queryAll(`SELECT c.*, u.username, u.nick_name FROM checkin_records c LEFT JOIN users u ON c.user_id = u.id ${where} ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM checkin_records c ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getUserCheckinStats(userId) {
  const stats = queryOne(`SELECT COUNT(*) as total_checkins, SUM(reward_amount) as total_reward FROM checkin_records WHERE user_id = ?`, [userId]);
  const lastCheckin = queryOne(`SELECT checkin_date FROM checkin_records WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1`, [userId]);
  return {
    total_checkins: stats.total_checkins || 0,
    total_reward: stats.total_reward || 0,
    last_checkin_date: lastCheckin ? lastCheckin.checkin_date : null
  };
}

function deleteCheckinRecord(id) {
  run('DELETE FROM checkin_records WHERE id = ?', [id]);
}

// ========== 用户管理：签到功能 ==========
function checkin(userId, rewardAmount = 1, rewardCoin = 'USDT') {
  const today = new Date().toISOString().split('T')[0];
  const existing = queryOne('SELECT id FROM checkin_records WHERE user_id = ? AND checkin_date = ?', [userId, today]);
  if (existing) {
    return { success: false, message: '今日已签到' };
  }
  run(`INSERT INTO checkin_records (user_id, checkin_date, reward_amount, reward_coin) VALUES (?, ?, ?, ?)`,
    [userId, today, rewardAmount, rewardCoin]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return { success: true, id: row.id };
}

// ========== 财务管理：充币记录 ==========
function getRechargeRecords(page = 1, size = 20, userId = null, status = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (userId) { where += ' AND r.user_id = ?'; params.push(userId); }
  if (status && status !== 'all') { where += ' AND r.status = ?'; params.push(status); }
  const records = queryAll(`SELECT r.*, u.username, u.nick_name, u.username AS user_identity, r.coin_symbol AS coin_name FROM recharge_records r LEFT JOIN users u ON r.user_id = u.id ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM recharge_records r ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getRechargeById(id) {
  return queryOne('SELECT r.*, u.username, u.nick_name, u.username AS user_identity, r.coin_symbol AS coin_name FROM recharge_records r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ?', [id]);
}

function updateRechargeStatus(id, status, adminRemark = '', reviewedBy = null) {
  run(`UPDATE recharge_records SET status = ?, admin_remark = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`,
    [status, adminRemark || '', reviewedBy, id]);
}

function deleteRechargeRecord(id) {
  run('DELETE FROM recharge_records WHERE id = ?', [id]);
}

// ========== 财务管理：提币审核 ==========
function getWithdrawRecords(page = 1, size = 20, userId = null, status = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (userId) { where += ' AND w.user_id = ?'; params.push(userId); }
  if (status && status !== 'all') { where += ' AND w.status = ?'; params.push(status); }
  const records = queryAll(`SELECT w.*, u.username, u.nick_name, u.username AS user_identity, w.coin_symbol AS coin_name FROM withdraw_records w LEFT JOIN users u ON w.user_id = u.id ${where} ORDER BY w.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM withdraw_records w ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getWithdrawById(id) {
  return queryOne('SELECT w.*, u.username, u.nick_name, u.username AS user_identity, w.coin_symbol AS coin_name FROM withdraw_records w LEFT JOIN users u ON w.user_id = u.id WHERE w.id = ?', [id]);
}

function updateWithdrawStatus(id, status, adminRemark = '', txHash = '', reviewedBy = null) {
  run(`UPDATE withdraw_records SET status = ?, admin_remark = ?, tx_hash = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`,
    [status, adminRemark || '', txHash || '', reviewedBy, id]);
}

function deleteWithdrawRecord(id) {
  run('DELETE FROM withdraw_records WHERE id = ?', [id]);
}

// ========== 财务管理：划转记录 ==========
function getTransferRecords(page = 1, size = 20, userId = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (userId) { where += ' AND user_id = ?'; params.push(userId); }
  const records = queryAll(`SELECT t.*, u.username, u.nick_name, u.username AS user_identity, 
    CASE WHEN t.from_coin = 'USDT' THEN 'out' ELSE 'in' END AS direction 
    FROM transfer_records t LEFT JOIN users u ON t.user_id = u.id ${where} ORDER BY t.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM transfer_records t ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getTransferById(id) {
  return queryOne('SELECT t.*, u.username, u.nick_name, u.username AS user_identity, CASE WHEN t.from_coin = \'USDT\' THEN \'out\' ELSE \'in\' END AS direction FROM transfer_records t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?', [id]);
}

function deleteTransferRecord(id) {
  run('DELETE FROM transfer_records WHERE id = ?', [id]);
}

// ========== 财务管理：资产明细 ==========
function getFlowRecords(page = 1, size = 20, userId = null, type = null, coinSymbol = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (userId) { where += ' AND f.user_id = ?'; params.push(userId); }
  if (type && type !== 'all') { where += ' AND f.type = ?'; params.push(type); }
  if (coinSymbol && coinSymbol !== 'all') { where += ' AND f.coin_symbol = ?'; params.push(coinSymbol); }
  const records = queryAll(`SELECT f.*, u.username, u.nick_name, u.username AS user_identity, 
    f.type AS account_type, f.balance AS balance_after, 
    (f.balance - f.amount) AS balance_before 
    FROM flow_records f LEFT JOIN users u ON f.user_id = u.id ${where} ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM flow_records f ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getFlowStats(userId = null) {
  let where = '';
  const params = [];
  if (userId) { where = 'WHERE user_id = ?'; params.push(userId); }
  const sql = `SELECT coin_symbol, SUM(amount) as total_amount, COUNT(*) as total_count FROM flow_records ${where} GROUP BY coin_symbol`;
  return queryAll(sql, params);
}

function deleteFlowRecord(id) {
  run('DELETE FROM flow_records WHERE id = ?', [id]);
}

// ========== 财务管理：用户资产 ==========
function getUserAssets(page = 1, size = 20, keyword = null) {
  let where = 'WHERE 1=1';
  const params = [];
  if (keyword) {
    where += ' AND (u.username LIKE ? OR u.email LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw);
  }
  const records = queryAll(`SELECT w.*, u.username, u.nick_name, u.username AS user_identity FROM wallets w LEFT JOIN users u ON w.user_id = u.id ${where} ORDER BY w.user_id ASC, w.coin_symbol ASC LIMIT ? OFFSET ?`,
    [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM wallets w LEFT JOIN users u ON w.user_id = u.id ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { records, total, size, current: page, pages: Math.ceil(total / size) };
}

function getUserAssetDetail(userId, coinSymbol) {
  return queryOne('SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?', [userId, coinSymbol]);
}

function updateUserAsset(userId, coinSymbol, available = null, frozen = null) {
  const existing = queryOne('SELECT id FROM wallets WHERE user_id = ? AND coin_symbol = ?', [userId, coinSymbol]);
  if (existing) {
    const sets = [];
    const params = [];
    if (available !== null) { sets.push('available = ?'); params.push(available); }
    if (frozen !== null) { sets.push('frozen = ?'); params.push(frozen); }
    params.push(userId, coinSymbol);
    run(`UPDATE wallets SET ${sets.join(', ')} WHERE user_id = ? AND coin_symbol = ?`, params);
  }
}

function getUserAssetSummary(userId) {
  return queryAll('SELECT * FROM wallets WHERE user_id = ? ORDER BY coin_symbol ASC', [userId]);
}

// ========== 财务管理：币种列表 ==========
function getCoinList(enabledOnly = false) {
  const sql = enabledOnly
    ? "SELECT id, base_name AS coin_name, symbol, withdraw_fee, min_withdraw, max_withdraw, publish_time, total_supply, circulating_supply, coin_content, icon, status FROM coin_pairs WHERE status = 1 ORDER BY sort_order ASC, id ASC"
    : "SELECT id, base_name AS coin_name, symbol, withdraw_fee, min_withdraw, max_withdraw, publish_time, total_supply, circulating_supply, coin_content, icon, status FROM coin_pairs ORDER BY sort_order ASC, id ASC";
  return queryAll(sql);
}

function createCoin(data) {
  const { symbol, base_coin, quote_coin, base_name, icon, status, withdraw_fee, min_withdraw, max_withdraw, publish_time, total_supply, circulating_supply, coin_content } = data;
  run(`INSERT INTO coin_pairs (symbol, base_coin, quote_coin, base_name, icon, status, withdraw_fee, min_withdraw, max_withdraw, publish_time, total_supply, circulating_supply, coin_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [symbol, base_coin || '', quote_coin || '', base_name || '', icon || '', status || 1, withdraw_fee || 0, min_withdraw || 0, max_withdraw || 0, publish_time || null, total_supply || 0, circulating_supply || 0, coin_content || '']);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function updateCoin(id, data) {
  const sets = [];
  const params = [];
  if (data.symbol !== undefined) { sets.push('symbol = ?'); params.push(data.symbol); }
  if (data.base_coin !== undefined) { sets.push('base_coin = ?'); params.push(data.base_coin); }
  if (data.quote_coin !== undefined) { sets.push('quote_coin = ?'); params.push(data.quote_coin); }
  if (data.base_name !== undefined) { sets.push('base_name = ?'); params.push(data.base_name); }
  if (data.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(data.sort_order); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.icon !== undefined) { sets.push('icon = ?'); params.push(data.icon); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run(`UPDATE coin_pairs SET ${sets.join(', ')} WHERE id = ?`, params);
}

function deleteCoin(id) {
  run('DELETE FROM coin_pairs WHERE id = ?', [id]);
}

function toggleCoinStatus(id, status) {
  run(`UPDATE coin_pairs SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status ? 1 : 0, id]);
}

// 导出新增函数


// ========== 客服管理 ==========
function getCustomerService() {
  let cs = queryOne('SELECT * FROM customer_service ORDER BY id DESC LIMIT 1');
  if (!cs) {
    run("INSERT INTO customer_service (name, welcome_message) VALUES ('Customer Service', 'Hello, how can I help you?')");
    cs = queryOne('SELECT * FROM customer_service ORDER BY id DESC LIMIT 1');
  }
  return cs;
}

function updateCustomerService(data) {
  const { name, avatar, welcome_message, enabled } = data;
  const cs = getCustomerService();
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

function getCsMessages(page, size, status) {
  page = page || 1;
  size = size || 20;
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  const list = queryAll('SELECT * FROM cs_messages ' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?', [...params, size, (page - 1) * size]);
  const cnt = queryOne('SELECT COUNT(*) as cnt FROM cs_messages ' + where, params);
  return { list, total: cnt ? cnt.cnt : 0 };
}

function addCsMessage(data) {
  const { user_id, username, message } = data;
  run('INSERT INTO cs_messages (user_id, username, message) VALUES (?, ?, ?)', [user_id, username || '', message]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}

function replyCsMessage(id, reply) {
  run("UPDATE cs_messages SET reply = ?, status = 'replied', replied_at = datetime('now') WHERE id = ?", [reply, id]);
}

function deleteCsMessage(id) {
  run('DELETE FROM cs_messages WHERE id = ?', [id]);
}

// ========== 配置管理 ==========
function getConfigByCategory(category) {
  return queryAll('SELECT * FROM config_settings WHERE category = ? ORDER BY id', [category]);
}
function upsertConfig(category, key, value, label, valueType) {
  const existing = queryOne('SELECT id FROM config_settings WHERE category = ? AND key = ?', [category, key]);
  if (existing) {
    run("UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime('now') WHERE category = ? AND key = ?", [value, label || key, valueType || 'text', category, key]);
    return existing.id;
  } else {
    run('INSERT INTO config_settings (category, key, value, label, value_type) VALUES (?, ?, ?, ?, ?)', [category, key, value, label || key, valueType || 'text']);
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row ? row.id : 0;
  }
}
function deleteConfig(id) {
  run('DELETE FROM config_settings WHERE id = ?', [id]);
}

// ========== 轮播图管理 ==========
function getHomepageBanners(enabledOnly = false) {
  const sql = enabledOnly
    ? 'SELECT * FROM homepage_banners WHERE enabled = 1 ORDER BY sort_order ASC, id DESC'
    : 'SELECT * FROM homepage_banners ORDER BY sort_order ASC, id DESC';
  return queryAll(sql);
}

function getHomepageBannerById(id) {
  return queryOne('SELECT * FROM homepage_banners WHERE id = ?', [id]);
}

function createHomepageBanner(data) {
  const { title, image_url, link_url, description, sort_order, enabled, start_time, end_time } = data;
  run(`INSERT INTO homepage_banners (title, image_url, link_url, description, sort_order, enabled, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, image_url, link_url || '', description || '', sort_order || 0, enabled !== undefined ? enabled : 1, start_time || null, end_time || null]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}

function updateHomepageBanner(id, data) {
  const { title, image_url, link_url, description, sort_order, enabled, start_time, end_time } = data;
  const sets = [];
  const params = [];
  if (title !== undefined) { sets.push('title = ?'); params.push(title); }
  if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
  if (link_url !== undefined) { sets.push('link_url = ?'); params.push(link_url); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
  if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  if (start_time !== undefined) { sets.push('start_time = ?'); params.push(start_time); }
  if (end_time !== undefined) { sets.push('end_time = ?'); params.push(end_time); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run('UPDATE homepage_banners SET ' + sets.join(', ') + ' WHERE id = ?', params);
}

function deleteHomepageBanner(id) {
  run('DELETE FROM homepage_banners WHERE id = ?', [id]);
}

function toggleHomepageBanner(id, enabled) {
  run('UPDATE homepage_banners SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?', [enabled ? 1 : 0, id]);
}

// ========== 咨询项目管理 ==========
function getHomepageConsultations(enabledOnly = false) {
  const sql = enabledOnly
    ? 'SELECT * FROM homepage_consultations WHERE enabled = 1 ORDER BY is_top DESC, sort_order ASC, id DESC'
    : 'SELECT * FROM homepage_consultations ORDER BY is_top DESC, sort_order ASC, id DESC';
  return queryAll(sql);
}

function getHomepageConsultationById(id) {
  return queryOne('SELECT * FROM homepage_consultations WHERE id = ?', [id]);
}

function createHomepageConsultation(data) {
  const { title, content, image_url, category, author, sort_order, enabled, is_top } = data;
  run(`INSERT INTO homepage_consultations (title, content, image_url, category, author, sort_order, enabled, is_top)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, content || '', image_url || '', category || 'news', author || '', sort_order || 0, enabled !== undefined ? enabled : 1, is_top ? 1 : 0]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}

function updateHomepageConsultation(id, data) {
  const { title, content, image_url, category, author, sort_order, enabled, is_top } = data;
  const sets = [];
  const params = [];
  if (title !== undefined) { sets.push('title = ?'); params.push(title); }
  if (content !== undefined) { sets.push('content = ?'); params.push(content); }
  if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
  if (category !== undefined) { sets.push('category = ?'); params.push(category); }
  if (author !== undefined) { sets.push('author = ?'); params.push(author); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
  if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  if (is_top !== undefined) { sets.push('is_top = ?'); params.push(is_top ? 1 : 0); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run('UPDATE homepage_consultations SET ' + sets.join(', ') + ' WHERE id = ?', params);
}

function deleteHomepageConsultation(id) {
  run('DELETE FROM homepage_consultations WHERE id = ?', [id]);
}

function toggleHomepageConsultation(id, enabled) {
  run('UPDATE homepage_consultations SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?', [enabled ? 1 : 0, id]);
}

// 导出新增函数
module.exports = { queryOne, queryAll, run, ensureDb, getDbSync, saveDb, markDirty,
  // 配置管理
  getConfigByCategory, upsertConfig, deleteConfig,
  getFrontendControls, setFrontendControl, deleteFrontendControl, toggleFrontendControl,
  getUserRestrictions, getAllUserRestrictions, setUserRestriction, deleteUserRestriction, batchSetRestrictions,
  getMarketOverrides, setMarketOverride, deleteMarketOverride, toggleMarketOverride,
  addControlCommand, getPendingCommands, markCommandSent, cleanExpiredCommands,
  getRoles, getRoleById, createRole, updateRole, deleteRole,
  getRolePermissions, setRolePermissions, getRoleMenus, setRoleMenus,
  getPermissions,
  getMenus, getMenuTree, createMenu, updateMenu, deleteMenu,
  getUserRoles, setUserRoles,
  addOperationLog, getOperationLogs, deleteOperationLog, cleanOldOperationLogs,
  // Moonpay
  getMoonpayConfig, createMoonpayConfig, updateMoonpayConfig, deleteMoonpayConfig, toggleMoonpayConfig,
  getMoonpayOrders, getMoonpayOrderById, createMoonpayOrder, updateMoonpayOrderStatus, deleteMoonpayOrder,
  // ========== 用户管理 ==========
  // 用户列表
  getUsers, getUserById, updateUserStatus, deleteUser,
  // 实名认证
  getUserVerifications, getUserVerificationByUserId, reviewUserVerification, deleteUserVerification,
  // 登录日志
  addLoginLog, getLoginLogs, deleteLoginLog, cleanOldLoginLogs,
  // 签到记录
  getCheckinRecords, getUserCheckinStats, deleteCheckinRecord,
  // ========== 财务管理 ==========
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
  // ========== 客服管理 ==========
  getCustomerService, updateCustomerService, getCsMessages, addCsMessage, replyCsMessage, deleteCsMessage,
  // ========== 轮播图管理 ==========
  getHomepageBanners, getHomepageBannerById, createHomepageBanner, updateHomepageBanner, deleteHomepageBanner, toggleHomepageBanner,
  // ========== 咨询项目管理 ==========
  getHomepageConsultations, getHomepageConsultationById, createHomepageConsultation, updateHomepageConsultation, deleteHomepageConsultation, toggleHomepageConsultation,
};

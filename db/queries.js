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

// 导出新增函数
module.exports = { queryOne, queryAll, run, ensureDb, getDbSync, saveDb, markDirty,
  getFrontendControls, setFrontendControl, deleteFrontendControl, toggleFrontendControl,
  getUserRestrictions, getAllUserRestrictions, setUserRestriction, deleteUserRestriction, batchSetRestrictions,
  getMarketOverrides, setMarketOverride, deleteMarketOverride, toggleMarketOverride,
  addControlCommand, getPendingCommands, markCommandSent, cleanExpiredCommands,
};

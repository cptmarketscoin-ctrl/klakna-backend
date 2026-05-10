/**
 * 操作日志中间件 v1
 * 自动记录管理员操作到 operation_logs 表
 */

const { addOperationLog } = require('../db/queries');
const { verifyAdmin } = require('./auth');

/**
 * 操作日志中间件
 * 在 server.js 中应用于 admin 路由
 */
function operationLogger(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const admin = verifyAdmin(authHeader);

  if (admin) {
    // 记录操作
    const username = admin.username || 'admin';
    const userId = admin.id || null;
    const action = `${req.method} ${req.path}`;
    const module = 'admin';
    const detail = JSON.stringify(req.body || {}).substring(0, 500);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || null;

    try {
      addOperationLog(userId, username, action, module, detail, ip);
    } catch(e) {
      console.error('[OperationLogger] Failed to log:', e.message);
    }
  }

  next();
}

/**
 * 手动记录操作（在 handler 中调用）
 * @param {number} userId - 用户 ID
 * @param {string} username - 用户名
 * @param {string} action - 操作动作
 * @param {string} module - 模块名称
 * @param {string} detail - 详细信息
 * @param {string} ip - IP 地址
 */
function logOperation(userId, username, action, module, detail = null, ip = null) {
  try {
    addOperationLog(userId, username, action, module, detail, ip);
  } catch(e) {
    console.error('[OperationLogger] Failed to log:', e.message);
  }
}

module.exports = { operationLogger, logOperation };

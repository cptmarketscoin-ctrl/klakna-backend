/**
 * 前端客服 API 处理器
 * 供前端用户使用的客服接口
 */

const { queryOne, queryAll, run, getDbSync, saveDb,
  getCustomerService, addCsMessage, getCsMessages, replyCsMessage, deleteCsMessage
} = require('../db/queries');
const { verifyToken } = require('../middleware/auth');

// ========== 获取客服配置 ==========
// GET /api/cs/config
// 不需要认证 - 所有人都可以查看客服配置
function handleCsConfig(path, body, query, user) {
  try {
    const cs = getCustomerService();
    return {
      code: 200,
      data: {
        name: cs.name || 'Customer Service',
        welcome_message: cs.welcome_message || 'Hello, how can I help you?',
        enabled: cs.enabled !== undefined ? cs.enabled : 1
      },
      msg: 'success'
    };
  } catch (e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ========== 用户发送消息 ==========
// POST /api/cs/send
// 需要认证 - 用户必须登录
function handleCsSend(path, body, query, user) {
  if (!user) {
    return { code: 401, data: null, msg: 'Please login first' };
  }

  const { message } = body;
  if (!message || !message.trim()) {
    return { code: 400, data: null, msg: 'Message cannot be empty' };
  }

  // 检查消息长度
  if (message.length > 1000) {
    return { code: 400, data: null, msg: 'Message too long (max 1000 characters)' };
  }

  try {
    const userId = user.id;
    const username = user.username || '';

    // 添加消息到数据库
    const msgId = addCsMessage({
      user_id: userId,
      username: username,
      message: message.trim()
    });

    return {
      code: 200,
      data: { id: msgId },
      msg: 'Message sent successfully'
    };
  } catch (e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ========== 用户查看消息和回复 ==========
// GET /api/cs/messages
// 需要认证 - 用户只能查看自己的消息
function handleCsMessages(path, body, query, user) {
  if (!user) {
    return { code: 401, data: null, msg: 'Please login first' };
  }

  const page = parseInt(query.page) || 1;
  const size = parseInt(query.size) || 20;

  try {
    const userId = user.id;

    // 只获取当前用户的消息
    const list = queryAll(
      'SELECT * FROM cs_messages WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
      [userId, size, (page - 1) * size]
    );

    const cnt = queryOne('SELECT COUNT(*) as cnt FROM cs_messages WHERE user_id = ?', [userId]);

    // 标记所有回复为已读
    run('UPDATE cs_messages SET status = "read" WHERE user_id = ? AND status = "replied" AND reply IS NOT NULL AND reply != ""', [userId]);

    return {
      code: 200,
      data: {
        list: list.reverse(), // 反转顺序，让最早的消息在前面
        total: cnt ? cnt.cnt : 0,
        page: page,
        size: size
      },
      msg: 'success'
    };
  } catch (e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ========== 获取未读回复数量 ==========
// GET /api/cs/unread-count
// 需要认证 - 用户查看自己的未读回复数
function handleCsUnreadCount(path, body, query, user) {
  if (!user) {
    return { code: 401, data: null, msg: 'Please login first' };
  }

  try {
    const userId = user.id;

    const cnt = queryOne(
      'SELECT COUNT(*) as cnt FROM cs_messages WHERE user_id = ? AND status = "replied" AND (reply IS NOT NULL AND reply != "")',
      [userId]
    );

    return {
      code: 200,
      data: { count: cnt ? cnt.cnt : 0 },
      msg: 'success'
    };
  } catch (e) {
    return { code: 500, data: null, msg: e.message };
  }
}

// ========== 路由匹配 ==========
const csRoutes = {
  'GET': {
    '/exchange/cs/config': handleCsConfig,
    '/exchange/cs/messages': handleCsMessages,
    '/exchange/cs/unread-count': handleCsUnreadCount,
  },
  'POST': {
    '/exchange/cs/send': handleCsSend,
  }
};

function match(method, path) {
  const methodRoutes = csRoutes[method];
  if (!methodRoutes) return null;
  return methodRoutes[path] || null;
}

module.exports = { match };

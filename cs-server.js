/**
 * 客服API独立服务器
 * 运行在端口8081，处理所有客服相关API
 * 完全独立，不依赖 server.js 的路由逻辑
 */

const express = require('express');
const cors = require('cors');
const { queryOne, queryAll, run, getDbSync } = require('./db/queries');

const app = express();
app.use(cors());
app.use(express.json());

// ========== 客服配置API ==========
app.get('/cs/config', (req, res) => {
  try {
    const cs = queryOne('SELECT * FROM customer_service ORDER BY id DESC LIMIT 1');
    res.json({
      code: 200,
      data: {
        name: cs?.name || 'Customer Service',
        welcome_message: cs?.welcome_message || 'Hello, how can I help you?',
        enabled: cs?.enabled !== undefined ? cs.enabled : 1
      },
      msg: 'success'
    });
  } catch (e) {
    res.json({ code: 500, data: null, msg: e.message });
  }
});

// ========== 用户发送消息 ==========
app.post('/cs/send', (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) {
    return res.json({ code: 401, data: null, msg: 'Please login first' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const user = jwt.verify(authHeader.replace('Bearer ', ''), require('./config').JWT_SECRET);
    
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.json({ code: 400, data: null, msg: 'Message cannot be empty' });
    }

    // 添加消息
    run('INSERT INTO cs_messages (user_id, username, message) VALUES (?, ?, ?)',
      [user.id, user.username || '', message.trim()]);
    
    const row = queryOne('SELECT last_insert_rowid() as id');
    res.json({ code: 200, data: { id: row?.id || 0 }, msg: 'Message sent successfully' });
  } catch (e) {
    res.json({ code: 500, data: null, msg: e.message });
  }
});

// ========== 用户查看消息 ==========
app.get('/cs/messages', (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) {
    return res.json({ code: 401, data: null, msg: 'Please login first' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const user = jwt.verify(authHeader.replace('Bearer ', ''), require('./config').JWT_SECRET);
    
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;

    const list = queryAll(
      'SELECT * FROM cs_messages WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
      [user.id, size, (page - 1) * size]
    );

    const cnt = queryOne('SELECT COUNT(*) as cnt FROM cs_messages WHERE user_id = ?', [user.id]);

    // 标记已读
    run('UPDATE cs_messages SET status = "read" WHERE user_id = ? AND status = "replied" AND reply IS NOT NULL AND reply != ""', [user.id]);

    res.json({
      code: 200,
      data: {
        list: list.reverse(),
        total: cnt ? cnt.cnt : 0,
        page: page,
        size: size
      },
      msg: 'success'
    });
  } catch (e) {
    res.json({ code: 500, data: null, msg: e.message });
  }
});

// ========== 获取未读回复数 ==========
app.get('/cs/unread-count', (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) {
    return res.json({ code: 401, data: null, msg: 'Please login first' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const user = jwt.verify(authHeader.replace('Bearer ', ''), require('./config').JWT_SECRET);
    
    const cnt = queryOne(
      'SELECT COUNT(*) as cnt FROM cs_messages WHERE user_id = ? AND status = "replied" AND (reply IS NOT NULL AND reply != "")',
      [user.id]
    );

    res.json({
      code: 200,
      data: { count: cnt ? cnt.cnt : 0 },
      msg: 'success'
    });
  } catch (e) {
    res.json({ code: 500, data: null, msg: e.message });
  }
});

// ========== 启动服务器 ==========
const PORT = 8081;
app.listen(PORT, () => {
  console.log('[CS Server] 客服API服务器启动成功，端口:', PORT);
  console.log('[CS Server] 测试: curl <http://localhost:|http://localhost:>' + PORT + '/cs/config');
});

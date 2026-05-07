/**
 * Control WebSocket 服务
 * 后端向前端推送实时控制指令
 *
 * 路径: /ws/control
 * 前端连接时需携带 JWT token（query 参数或 Sec-WebSocket-Protocol）
 *
 * 消息格式:
 *   服务端 → 客户端: { type: 'command|config_update|market_update|restriction_update', data: {...} }
 *   客户端 → 服务端: { type: 'ping' | 'auth', token?: '...' }
 */
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');

// 连接池：userId → Set<ws>
const connections = new Map();

// 创建 WebSocket Server（不绑定 HTTP server，由 server.js 手动 upgrade 处理）
let wss = null;

function init() {
  wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws, req) => {
    let userId = null;
    const clientIp = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || '-';

    // 从 query 参数提取 token
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || url.searchParams.get('t');

    if (token) {
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        userId = String(decoded.id);
      } catch(e) {}
    }

    if (!userId) {
      // 未认证连接，只允许接收广播
      console.log('[WS Control] 未认证连接:', clientIp);
    } else {
      // 注册到连接池
      if (!connections.has(userId)) connections.set(userId, new Set());
      connections.get(userId).add(ws);
      console.log('[WS Control] 用户连接:', userId, '| 在线:', getOnlineCount());

      // 发送当前控制配置
      sendCurrentConfig(ws, userId);
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString('utf-8'));
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
        } else if (msg.type === 'auth' && msg.token) {
          try {
            const decoded = jwt.verify(msg.token, config.JWT_SECRET);
            userId = String(decoded.id);
            if (!connections.has(userId)) connections.set(userId, new Set());
            connections.get(userId).add(ws);
            console.log('[WS Control] 延迟认证成功:', userId);
            sendCurrentConfig(ws, userId);
          } catch(e) {
            ws.send(JSON.stringify({ type: 'auth_failed', msg: 'Invalid token' }));
          }
        }
      } catch(e) {}
    });

    ws.on('close', () => {
      if (userId) {
        const userConns = connections.get(userId);
        if (userConns) {
          userConns.delete(ws);
          if (userConns.size === 0) connections.delete(userId);
        }
        console.log('[WS Control] 用户断开:', userId, '| 在线:', getOnlineCount());
      }
    });

    ws.on('error', (err) => {
      console.log('[WS Control] 连接错误:', err.message);
    });
  });

  console.log('[WS Control] ✅ WebSocket 控制服务已初始化');
}

// 发送当前控制配置给新连接
function sendCurrentConfig(ws, userId) {
  try {
    const { getUserRestrictions } = require('../db/queries');
    const restrictions = getUserRestrictions(userId);

    ws.send(JSON.stringify({
      type: 'config_update',
      data: {
        maintenanceMode: global.__maintenanceMode || false,
        announcement: global.__globalAnnouncement || '',
        priceOverrides: global.__priceOverrides || {},
        marketOverrides: global.__marketOverrides || {},
        restrictions: restrictions.map(r => ({ type: r.restrict_type, reason: r.reason })),
        frontendControls: global.__frontendControlsCache || [],
      }
    }));
  } catch(e) {}
}

// ========== 推送函数 ==========

// 向指定用户推送消息
function pushToUser(userId, message) {
  const conns = connections.get(String(userId));
  if (!conns) return false;
  const data = JSON.stringify(message);
  let sent = 0;
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      sent++;
    }
  }
  return sent > 0;
}

// 向所有用户广播
function broadcastCommand(message) {
  const data = JSON.stringify(message);
  let total = 0;
  for (const [userId, conns] of connections) {
    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        total++;
      }
    }
  }
  console.log('[WS Control] 广播消息给', total, '个连接');
  return total;
}

// 向所有用户推送配置更新
function broadcastConfigUpdate() {
  broadcastCommand({
    type: 'config_update',
    data: {
      maintenanceMode: global.__maintenanceMode || false,
      announcement: global.__globalAnnouncement || '',
      priceOverrides: global.__priceOverrides || {},
      marketOverrides: global.__marketOverrides || {},
      frontendControls: global.__frontendControlsCache || [],
    }
  });
}

// 处理 upgrade 请求
function handleUpgrade(req, socket, head) {
  if (!wss) return;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
}

// 获取在线连接数
function getOnlineCount() {
  let count = 0;
  for (const conns of connections.values()) count += conns.size;
  return count;
}

module.exports = { init, handleUpgrade, pushToUser, broadcastCommand, broadcastConfigUpdate, getOnlineCount };

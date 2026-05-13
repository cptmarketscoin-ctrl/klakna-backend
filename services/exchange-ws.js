/**
 * Exchange WebSocket Server
 * 自建行情推送，替代代理原站 WS（原站不给匿名人发行情）
 * 
 * 协议：
 *   client → server: "ping"（心跳）
 *   server → client: "pong"（心跳响应）
 *   server → client: JSON {type:"1004", symbol:"BTCUSDT", optionMakerResponse:{...}}
 * 
 * 数据类型：
 *   1002 = K线数据 (addCryptoKLines)
 *   1003 = 持仓重置 (resetCryptoPosition)  
 *   1004 = 行情更新 (resetOptionalMarket)
 */

const WebSocket = require('ws');
const logger = require('./logger');

// 价格格式化: 按金额分档统一小数位
const fmtPrice = (p) => p >= 1000 ? p.toFixed(2) : p >= 1 ? p.toFixed(3) : p >= 0.01 ? p.toFixed(4) : p.toFixed(6);

let wss = null;
let intervalId = null;
const PUSH_INTERVAL = 3000; // 每3秒推送一次

/** 从 __priceCache 生成行情消息 */
function buildMarketMessage(symbol, priceData) {
  if (!priceData || typeof priceData.price !== 'number') return null;
  
  const price = priceData.price;
  const change24h = priceData.change_24h || priceData.change24h || 0;
  const rate = change24h; // change_percent 已经是百分比数值
  
  return {
    type: '1004',
    symbol: symbol,
    optionMakerResponse: {
      rate: rate,          // 前端用 rate >= 0 判断涨跌
      lastPrice: fmtPrice(price),
      high: fmtPrice(priceData.high_24h || price * 1.02),
      low: fmtPrice(priceData.low_24h || price * 0.98),
      volume: priceData.volume_24h || 0,
      priceChange: Number((change24h * price / 100).toFixed(2)),
      priceChangePercent: change24h,
    }
  };
}

/** 广播行情到所有连接的客户端 */
function broadcastPrices() {
  if (!wss || wss.clients.size === 0) return;
  
  const priceCache = global.__priceCache;
  if (!priceCache || Object.keys(priceCache).length === 0) return;
  
  const messages = [];
  for (const [symbol, data] of Object.entries(priceCache)) {
    const msg = buildMarketMessage(symbol, data);
    if (msg) messages.push(msg);
  }
  
  // 批量发送
  const payload = JSON.stringify(messages);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // 每个币种单独发送（前端逐条处理）
      messages.forEach(msg => {
        client.send(JSON.stringify(msg));
      });
    }
  });
}

/** 启动 exchange WebSocket 服务 */
function start() {
  wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });
  
  // 心跳检测
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.__alive === false) {
        ws.terminate();
        return;
      }
      ws.__alive = false;
    });
  }, 15000);
  
  wss.on('connection', (ws) => {
    logger.info('[ExchangeWS] Client connected, total:', wss.clients.size);
    ws.__alive = true;
    
    ws.on('message', (data) => {
      const msg = data.toString().trim();
      if (msg === 'ping') {
        ws.send('pong');
        ws.__alive = true;
      }
    });
    
    ws.on('close', () => {
      logger.info('[ExchangeWS] Client disconnected, total:', wss.clients.size);
    });
    
    ws.on('error', (err) => {
      logger.error('[ExchangeWS] Client error:', err.message);
    });
  });
  
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(intervalId);
  });
  
  // 启动定时推送
  intervalId = setInterval(broadcastPrices, PUSH_INTERVAL);
  
  logger.info('[ExchangeWS] Started, push interval:', PUSH_INTERVAL + 'ms');
}

/** 处理 WebSocket upgrade（由 server.js 调用） */
function handleUpgrade(request, socket, head) {
  if (!wss) return;
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
}

module.exports = { start, handleUpgrade };

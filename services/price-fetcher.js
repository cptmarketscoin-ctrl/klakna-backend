/**
 * 实时价格获取服务 v2 - 稳定性优化版
 * 使用 CoinGecko 免费 API 定时拉取价格
 * 缓存到 global.__priceCache，并同步到 index_configures 表
 * 
 * v2 优化：
 * - 指数退避重试（应对 429/5xx 错误）
 * - 熔断机制（连续失败 5 次后熔断 60 秒）
 * - 请求缓存（减少 API 调用频率）
 * - 降级策略（API 失败时返回旧数据）
 */

const https = require('https');
const { queryAll, run, saveDb } = require('../db/queries');

// CoinGecko ID -> 我们的 symbol 映射
const COINGECKO_MAP = {
  'bitcoin':       { symbol: 'BTCUSDT', name: 'Bitcoin' },
  'ethereum':      { symbol: 'ETHUSDT', name: 'Ethereum' },
  'binancecoin':   { symbol: 'BNBUSDT', name: 'BNB' },
  'solana':        { symbol: 'SOLUSDT', name: 'Solana' },
  'ripple':        { symbol: 'XRPUSDT', name: 'XRP' },
  'usd-coin':      { symbol: 'USDCUSDT', name: 'USDC' },
  'cardano':       { symbol: 'ADAUSDT', name: 'Cardano' },
  'avalanche-2':  { symbol: 'AVAXUSDT', name: 'Avalanche' },
  'polkadot':     { symbol: 'DOTUSDT', name: 'Polkadot' },
  'chainlink':     { symbol: 'LINKUSDT', name: 'Chainlink' },
  'matic-network': { symbol: 'MATICUSDT', name: 'Polygon' },
  'shiba-inu':    { symbol: 'SHIBUSDT', name: 'Shiba Inu' },
  'litecoin':      { symbol: 'LTCUSDT', name: 'Litecoin' },
  'tron':          { symbol: 'TRXUSDT', name: 'TRON' },
  'uniswap':       { symbol: 'UNIUSDT', name: 'Uniswap' },
  'cosmos':        { symbol: 'ATOMUSDT', name: 'Cosmos' },
  'ethereum-classic': { symbol: 'ETCUSDT', name: 'Ethereum Classic' },
  'fantom':        { symbol: 'FTMUSDT', name: 'Fantom' },
  'aptos':         { symbol: 'APTUSDT', name: 'Aptos' },
  'arbitrum':      { symbol: 'ARBUSDT', name: 'Arbitrum' },
  'optimism':      { symbol: 'OPUSDT', name: 'Optimism' },
  'near':          { symbol: 'NEARUSDT', name: 'NEAR Protocol' },
  'sui':           { symbol: 'SUIUSDT', name: 'Sui' },
  'okb':           { symbol: 'OKBUSDT', name: 'OKB' },
  'dai':           { symbol: 'DAIUSDT', name: 'Dai' },
  'dogecoin':      { symbol: 'DOGEUSDT', name: 'Dogecoin' },
  'filecoin':      { symbol: 'FILUSDT', name: 'Filecoin' },
  'pepe':          { symbol: 'PEPEUSDT', name: 'Pepe' },
  'floki':         { symbol: 'FLOKIUSDT', name: 'Floki' },
  'dogwifhat':    { symbol: 'WIFUSDT', name: 'dogwifhat' },
  'aave':          { symbol: 'AAVEUSDT', name: 'Aave' },
  'maker':         { symbol: 'MKRUSDT', name: 'Maker' },
};

const COINGECKO_IDS = Object.keys(COINGECKO_MAP).join(',');

// ============================================================
// 状态变量
// ============================================================
let priceCache = {};
let isFetching = false;
let intervalTimer = null;
const FETCH_INTERVAL = 30000; // 30 秒

// ============================================================
// 熔断器状态
// ============================================================
const CIRCUIT_STATE = {
  CLOSED: 'CLOSED',     // 正常状态，允许请求
  OPEN: 'OPEN',         // 熔断状态，拒绝请求
  HALF_OPEN: 'HALF_OPEN' // 尝试恢复状态
};

let circuitState = CIRCUIT_STATE.CLOSED;
let failureCount = 0;
const FAILURE_THRESHOLD = 5;  // 连续失败 5 次后熔断
const RECOVERY_TIMEOUT = 60000; // 熔断后 60 秒尝试恢复
let lastFailureTime = 0;
let lastSuccessTime = 0;

// ============================================================
// 重试配置
// ============================================================
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 基础延迟 1 秒
const MAX_DELAY = 10000; // 最大延迟 10 秒

// ============================================================
// HTTPS GET 封装 —— 支持重试和超时
// ============================================================
function httpsGet(url, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'klakna-backend/4.0 (+https://klakna.sbs)',
        'Accept': 'application/json',
      },
      timeout: 10000,
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          reject(new Error('Parse error: ' + data.slice(0, 200)));
        }
      });
    });
    
    req.on('error', (err) => {
      // 网络错误，尝试重试
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY * Math.pow(2, retryCount), MAX_DELAY);
        console.log(`[PriceFetcher] Request failed, retrying in ${delay}ms (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => {
          httpsGet(url, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, delay);
      } else {
        reject(err);
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY * Math.pow(2, retryCount), MAX_DELAY);
        console.log(`[PriceFetcher] Request timeout, retrying in ${delay}ms (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => {
          httpsGet(url, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, delay);
      } else {
        reject(new Error('Request timeout after retries'));
      }
    });
    
    req.end();
  });
}

// ============================================================
// 熔断器逻辑
// ============================================================
function shouldAttemptRequest() {
  if (circuitState === CIRCUIT_STATE.CLOSED) {
    return true;
  }
  
  if (circuitState === CIRCUIT_STATE.OPEN) {
    const timeSinceLastFailure = Date.now() - lastFailureTime;
    if (timeSinceLastFailure > RECOVERY_TIMEOUT) {
      circuitState = CIRCUIT_STATE.HALF_OPEN;
      console.log('[PriceFetcher] Circuit breaker: Entering HALF_OPEN state');
      return true;
    }
    return false;
  }
  
  // HALF_OPEN state: allow one request to test
  return true;
}

function recordSuccess() {
  failureCount = 0;
  lastSuccessTime = Date.now();
  
  if (circuitState === CIRCUIT_STATE.HALF_OPEN) {
    circuitState = CIRCUIT_STATE.CLOSED;
    console.log('[PriceFetcher] Circuit breaker: Recovered, entering CLOSED state');
  }
}

function recordFailure() {
  failureCount++;
  lastFailureTime = Date.now();
  
  if (failureCount >= FAILURE_THRESHOLD && circuitState === CIRCUIT_STATE.CLOSED) {
    circuitState = CIRCUIT_STATE.OPEN;
    console.warn(`[PriceFetcher] Circuit breaker: OPEN (${failureCount} failures)`);
  }
}

// ============================================================
// 从 CoinGecko 拉取价格并写入缓存 + DB
// ============================================================
async function fetchPrices() {
  if (isFetching) {
    console.log('[PriceFetcher] Already fetching, skipping...');
    return;
  }
  
  // 检查熔断器状态
  if (!shouldAttemptRequest()) {
    console.warn('[PriceFetcher] Circuit breaker is OPEN, skipping request');
    return;
  }
  
  isFetching = true;
  
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
    const { status, data } = await httpsGet(url);

    if (status !== 200) {
      console.warn(`[PriceFetcher] CoinGecko returned ${status}, keeping last prices`);
      
      // 429 或 5xx 错误，记录失败
      if (status === 429 || status >= 500) {
        recordFailure();
      }
      
      isFetching = false;
      return;
    }

    // 成功获取数据和 DB
    recordSuccess();
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let updated = 0;

    for (const [cgId, info] of Object.entries(COINGECKO_MAP)) {
      const d = data[cgId];
      if (!d || d.usd === undefined) continue;

      const price         = d.usd;
      const changePercent = d.usd_24h_change || 0;
      const volume24h     = d.usd_24h_vol || 0;
      const marketCap     = d.usd_market_cap || 0;

      priceCache[info.symbol] = {
        price,
        change_24h: changePercent,
        change_percent: changePercent,
        volume_24h: volume24h,
        market_cap: marketCap,
        updated_at: now,
      };

      try {
        const dbSymbol = info.symbol.replace('USDT', '');
        const existing = queryAll("SELECT id FROM index_configures WHERE symbol = ?", [dbSymbol]);
        if (existing && existing.length > 0) {
          run(
            `UPDATE index_configures SET price=?, change_24h=?, change_percent=?, volume_24h=?, market_cap=?, updated_at=? WHERE symbol=?`,
            [price, changePercent, changePercent, volume24h, marketCap, now, dbSymbol]
          );
        } else {
          run(
            `INSERT INTO index_configures (name, symbol, price, change_24h, change_percent, volume_24h, market_cap, sort_order, enabled, remark, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '', ?)`,
            [info.name, dbSymbol, price, changePercent, changePercent, volume24h, marketCap, Object.keys(priceCache).length, now]
          );
        }
        updated++;
      } catch(e) {
        console.error('[PriceFetcher] DB sync error:', e.message);
      }
    }

    global.__priceCache = priceCache;
    try { saveDb(); } catch(e) {}
    
    console.log(`[PriceFetcher] ✅ Updated ${updated} coins at ${now} (Circuit: ${circuitState})`);
  } catch(e) {
    console.warn('[PriceFetcher] ❌ Fetch error:', e.message);
    recordFailure();
  }
  
  isFetching = false;
}

// ============================================================
// 初始化和清理
// ============================================================
function init() {
  if (intervalTimer) return;
  console.log('[PriceFetcher] Initializing...');
  fetchPrices();
  intervalTimer = setInterval(fetchPrices, FETCH_INTERVAL);
  console.log(`[PriceFetcher] Started, interval: ${FETCH_INTERVAL}ms`);
}

function stop() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
    console.log('[PriceFetcher] Stopped');
  }
}

// ============================================================
// 公共接口
// ============================================================
function getCache() {
  return priceCache;
}

function getPrice(symbol) {
  return priceCache[symbol.toUpperCase()] || null;
}

async function fetchNow() {
  await fetchPrices();
  return { 
    code: 200, 
    data: priceCache, 
    msg: 'Prices refreshed',
    circuitState: circuitState,
    failureCount: failureCount
  };
}

function getStatus() {
  return {
    circuitState: circuitState,
    failureCount: failureCount,
    lastSuccessTime: lastSuccessTime,
    lastFailureTime: lastFailureTime,
    cacheSize: Object.keys(priceCache).length
  };
}

module.exports = { init, stop, getCache, getPrice, fetchNow, getStatus };

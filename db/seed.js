/**
 * 种子数据 — 币种对
 * 启动时检查是否已有数据，没有则插入
 */
const { getDb, saveDb } = require('./index');

async function seed() {
  const db = await getDb();

  // 检查是否已有币种
  const existing = db.exec("SELECT COUNT(*) FROM coin_pairs");
  if (existing[0] && existing[0].values[0][0] > 0) return;

  console.log('[Seed] 插入种子数据...');

  const coins = [
    { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', name: 'Bitcoin', sort: 999, icon: 'icon-btc' },
    { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', name: 'Ethereum', sort: 998, icon: 'icon-eth' },
    { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', name: 'BNB', sort: 997, icon: 'icon-bnb' },
    { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', name: 'Solana', sort: 996, icon: 'icon-sol' },
    { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', name: 'XRP', sort: 995, icon: 'icon-xrp' },
    { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', name: 'Dogecoin', sort: 994, icon: 'icon-doge' },
    { symbol: 'ADAUSDT', base: 'ADA', quote: 'USDT', name: 'Cardano', sort: 993, icon: 'icon-ada' },
    { symbol: 'DOTUSDT', base: 'DOT', quote: 'USDT', name: 'Polkadot', sort: 992, icon: 'icon-dot' },
    { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', name: 'Avalanche', sort: 991, icon: 'icon-avax' },
    { symbol: 'MATICUSDT', base: 'MATIC', quote: 'USDT', name: 'Polygon', sort: 990, icon: 'icon-matic' },
    { symbol: 'LINKUSDT', base: 'LINK', quote: 'USDT', name: 'Chainlink', sort: 989, icon: 'icon-link' },
    { symbol: 'UNIUSDT', base: 'UNI', quote: 'USDT', name: 'Uniswap', sort: 988, icon: 'icon-uni' },
  ];

  const stmt = db.prepare("INSERT INTO coin_pairs (symbol, base_coin, quote_coin, base_name, sort_order, icon) VALUES (?, ?, ?, ?, ?, ?)");
  for (const c of coins) {
    stmt.run([c.symbol, c.base, c.quote, c.name, c.sort, c.icon]);
  }
  stmt.free();

  saveDb();
  console.log(`[Seed] 已插入 ${coins.length} 个币种对`);
}

module.exports = { seed };

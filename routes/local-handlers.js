/**
 * 本地 API 处理器
 * 纯函数，不依赖 Express，避免消费 request body 或干扰代理
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, run, getDbSync, saveDb } = require('../db/queries');
const { signToken } = require('../middleware/auth');
const config = require('../config');

// 路由匹配表
const routes = {
  'POST': {
    '/exchange/user': handleUserInfo,
    '/exchange/user/login': handleLogin,
    '/exchange/user/register': handleRegister,
    '/exchange/user/walletLogin': handleWalletLogin,
    '/exchange/user/walletRegister': handleWalletLogin,
    '/exchange/user/getUserInfo': handleGetUserInfo,
    '/exchange/user/updateUserInfo': handleUpdateUserInfo,
    '/exchange/user/updatePassword': handleUpdatePassword,
    '/exchange/user/forgetPassword': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/updateTransactionPsw': handleUpdateTxPsw,
    '/exchange/user/verificationPassword': handleVerifyTxPsw,
    '/exchange/user/userLogout': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/getGoogleCode': () => ({ code: 200, data: { secret: '', qrUrl: '' }, msg: 'success' }),
    '/exchange/user/verifyGoogleCode': () => ({ code: 200, data: true, msg: 'success' }),
    '/exchange/user/myInvite': handleMyInvite,
    '/exchange/user/changeDark': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/getUserKyc': () => ({ code: 200, data: { status: 0, level: 1 }, msg: 'success' }),

    '/exchange/wallet/getUserWallet': handleGetUserWallet,
    '/exchange/wallet/getTotalAssets': handleGetTotalAssets,
    '/exchange/wallet/getStockTotalAssets': () => ({ code: 200, data: { totalAssets: '0.00' }, msg: 'success' }),
    '/exchange/wallet/getWalletHistory': handleGetWalletHistory,
    '/exchange/wallet/userFlowRecord': handleGetWalletHistory,
    '/exchange/wallet/transferWallet': handleTransferWallet,
    '/exchange/wallet/convertSymbol': handleConvertSymbol,
    '/exchange/wallet/purchaseProductRecord': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/wallet/getUserTypeWallet': handleGetUserWallet,
    '/exchange/wallet/getUserStockWallet': () => ({ code: 200, data: [], msg: 'success' }),

    '/exchange/rockieCoin/coinBuy': handleCoinBuy,
    '/exchange/rockieCoin/coinFee': () => ({ code: 200, data: { spotFee: config.FEE_RATE * 100 + '%', futuresFee: config.FEE_RATE_FUTURES * 100 + '%' }, msg: 'success' }),
    '/exchange/rockieCoinFutures/futuresBuy': handleFuturesBuy,
    '/exchange/rockieCoinFutures/futuresClose': handleFuturesClose,

    '/exchange/Transaction/currency': handleTransactionCurrency,
    '/exchange/Transaction/currency/positionDetail': handlePositionDetail,
    '/exchange/Transaction/stock': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/Transaction/forex': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/Transaction/etf': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
  }
};

/**
 * 路由匹配 —— v3: 纯精确匹配
 * 所有路由必须在路由表中精确注册
 */
function match(method, path) {
  const methodRoutes = routes[method];
  if (!methodRoutes) return null;
  return methodRoutes[path] || null;
}

// ========== 用户 ==========

function handleLogin(path, body) {
  const { username, password, type } = body;
  if (type === 'wallet' || !password) {
    const addr = username;
    const user = queryOne("SELECT * FROM users WHERE wallet_address = ?", [addr]);
    if (!user) return { code: 400, data: null, msg: 'User not found' };
    return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
  }
  const user = queryOne("SELECT * FROM users WHERE (username = ? OR email = ? OR phone = ?) AND status = 1", [username, username, username]);
  if (!user || !user.password) return { code: 400, data: null, msg: 'Invalid credentials' };
  if (!bcrypt.compareSync(password, user.password)) return { code: 400, data: null, msg: 'Invalid credentials' };
  return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
}

function handleRegister(path, body) {
  const { username, password, type, walletAddress, inviteCode } = body;
  if (type === 'wallet' || walletAddress) {
    const existing = queryOne("SELECT id FROM users WHERE wallet_address = ?", [walletAddress]);
    if (existing) return { code: 400, data: null, msg: 'Wallet exists' };
    const code = generateCode();
    run("INSERT INTO users (wallet_address, nick_name, invite_code, invited_by) VALUES (?, ?, ?, ?)",
      [walletAddress, walletAddress.substring(0, 10), code, inviteCode || '']);
    const user = queryOne("SELECT * FROM users WHERE wallet_address = ?", [walletAddress]);
    createDefaultWallets(user.id);
    return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
  }
  if (!username || !password) return { code: 400, data: null, msg: 'Username and password required' };
  const existing = queryOne("SELECT id FROM users WHERE username = ? OR email = ?", [username, body.email || '']);
  if (existing) return { code: 400, data: null, msg: 'User exists' };
  const hash = bcrypt.hashSync(password, 10);
  const code = generateCode();
  run("INSERT INTO users (username, password, email, phone, nick_name, invite_code, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [username, hash, body.email || null, body.phone || null, username, code, inviteCode || '']);
  const user = queryOne("SELECT * FROM users WHERE username = ?", [username]);
  createDefaultWallets(user.id);
  return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
}

function handleWalletLogin(path, body) {
  const { address } = body;
  if (!address) return { code: 400, data: null, msg: 'Address required' };
  let user = queryOne("SELECT * FROM users WHERE wallet_address = ?", [address]);
  if (!user) {
    const code = generateCode();
    run("INSERT INTO users (wallet_address, nick_name, invite_code) VALUES (?, ?, ?)", [address, address.substring(0, 10), code]);
    user = queryOne("SELECT * FROM users WHERE wallet_address = ?", [address]);
    createDefaultWallets(user.id);
  }
  return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
}

function handleUserInfo(path, body, user) {
  if (!user) return { code: 200, data: null, msg: 'Not logged in' };
  return handleGetUserInfo(path, body, user);
}

function handleGetUserInfo(path, body, user) {
  if (!user) return { code: 200, data: null, msg: 'Not logged in' };
  const u = queryOne("SELECT * FROM users WHERE id = ?", [user.id]);
  if (!u) return { code: 404, data: null, msg: 'Not found' };
  const wallets = queryAll("SELECT * FROM wallets WHERE user_id = ? ORDER BY sort_order", [u.id]);
  const usdt = wallets.find(w => w.coin_symbol === 'USDT');
  const totalAssets = wallets.reduce((s, w) => s + (w.coin_symbol === 'USDT' ? w.available + w.frozen : 0), 0);
  return {
    code: 200, msg: 'success',
    data: { ...formatUser(u), token: '', balances: wallets, totalAssets: totalAssets.toFixed(2),
      availableBalance: (usdt ? usdt.available : 0).toFixed(2), freezeBalance: (usdt ? usdt.frozen : 0).toFixed(2),
      content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }
  };
}

function handleUpdateUserInfo(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { nickName, avatar, email, phone } = body;
  const sets = [], params = [];
  if (nickName !== undefined) { sets.push("nick_name = ?"); params.push(nickName); }
  if (avatar !== undefined) { sets.push("avatar = ?"); params.push(avatar); }
  if (email !== undefined) { sets.push("email = ?"); params.push(email); }
  if (phone !== undefined) { sets.push("phone = ?"); params.push(phone); }
  if (sets.length) { sets.push("updated_at = datetime('now')"); params.push(user.id); run(`UPDATE users SET ${sets.join(',')} WHERE id = ?`, params); }
  return { code: 200, data: null, msg: 'success' };
}

function handleUpdatePassword(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const u = queryOne("SELECT * FROM users WHERE id = ?", [user.id]);
  if (u.password && !bcrypt.compareSync(body.oldPassword, u.password)) return { code: 400, data: null, msg: 'Wrong password' };
  run("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?", [bcrypt.hashSync(body.newPassword, 10), user.id]);
  return { code: 200, data: null, msg: 'success' };
}

function handleUpdateTxPsw(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  run("UPDATE users SET trading_password = ? WHERE id = ?", [bcrypt.hashSync(body.transactionPsw || '123456', 10), user.id]);
  return { code: 200, data: null, msg: 'success' };
}

function handleVerifyTxPsw(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const u = queryOne("SELECT * FROM users WHERE id = ?", [user.id]);
  if (!u.trading_password) return { code: 200, data: true, msg: 'success' };
  const valid = bcrypt.compareSync(body.transactionPsw, u.trading_password);
  return { code: 200, data: valid, msg: valid ? 'success' : 'Wrong password' };
}

function handleMyInvite(path, body, user) {
  if (!user) return { code: 200, data: { inviteCode: '', invitedCount: 0 }, msg: 'success' };
  const u = queryOne("SELECT invite_code FROM users WHERE id = ?", [user.id]);
  return { code: 200, data: { inviteCode: u?.invite_code || '', invitedCount: 0, totalReward: '0.00' }, msg: 'success' };
}

// ========== 钱包 ==========

function handleGetUserWallet(path, body, user) {
  if (!user) return { code: 200, data: [] };
  const wallets = queryAll("SELECT * FROM wallets WHERE user_id = ? ORDER BY sort_order", [user.id]);
  return { code: 200, data: wallets.map(w => ({ coinSymbol: w.coin_symbol, coinName: w.coin_name, available: w.available, frozen: w.frozen, total: w.available + w.frozen, icon: w.icon })), msg: 'success' };
}

function handleGetTotalAssets(path, body, user) {
  if (!user) return { code: 200, data: { totalAssets: '0.00', availableBalance: '0.00', freezeBalance: '0.00' } };
  const wallets = queryAll("SELECT * FROM wallets WHERE user_id = ?", [user.id]);
  const usdt = wallets.find(w => w.coin_symbol === 'USDT') || { available: 0, frozen: 0 };
  const total = wallets.reduce((s, w) => s + (w.coin_symbol === 'USDT' ? w.available + w.frozen : 0), 0);
  return { code: 200, data: { totalAssets: total.toFixed(2), availableBalance: usdt.available.toFixed(2), freezeBalance: usdt.frozen.toFixed(2) }, msg: 'success' };
}

function handleGetWalletHistory(path, body, user) {
  if (!user) return { code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } } };
  const { page = 1, size = 10, coinSymbol, type } = body;
  let where = "WHERE user_id = ?", params = [user.id];
  if (coinSymbol) { where += " AND coin_symbol = ?"; params.push(coinSymbol); }
  if (type) { where += " AND type = ?"; params.push(type); }
  const records = queryAll(`SELECT * FROM flow_records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM flow_records ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleTransferWallet(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { fromSymbol, toSymbol, amount } = body;
  if (!fromSymbol || !toSymbol || amount <= 0) return { code: 400, data: null, msg: 'Invalid params' };
  const from = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, fromSymbol]);
  if (!from || from.available < amount) return { code: 400, data: null, msg: 'Insufficient balance' };
  const to = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, toSymbol]);
  if (!to) return { code: 400, data: null, msg: 'Target wallet not found' };
  const db = getDbSync();
  db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, fromSymbol]);
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, toSymbol]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [user.id, 'transfer', fromSymbol, -amount, from.available - amount, `Transfer to ${toSymbol}`]);
  saveDb();
  return { code: 200, data: null, msg: 'success' };
}

function handleConvertSymbol(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { fromSymbol, toSymbol, amount } = body;
  if (!fromSymbol || !toSymbol || amount <= 0) return { code: 400, data: null, msg: 'Invalid params' };
  const from = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, fromSymbol]);
  if (!from || from.available < amount) return { code: 400, data: null, msg: 'Insufficient balance' };
  const db = getDbSync();
  db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, fromSymbol]);
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, toSymbol]);
  saveDb();
  return { code: 200, data: { fromAmount: amount, toAmount: amount, rate: 1 }, msg: 'success' };
}

// ========== 交易 ==========

function handleCoinBuy(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { symbol, type, price, amount, total } = body;
  if (!symbol || !amount || amount <= 0) return { code: 400, data: null, msg: 'Invalid params' };
  const baseCoin = symbol.replace(/USDT$/, '');
  const side = type === 'sell' ? 'sell' : 'buy';
  const orderPrice = price || 0;
  const orderTotal = total || (orderPrice * amount);
  const fee = orderTotal * config.FEE_RATE;
  const orderNo = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
  const db = getDbSync();

  if (side === 'buy') {
    const usdt = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, 'USDT']);
    if (!usdt || usdt.available < orderTotal + fee) return { code: 400, data: null, msg: 'Insufficient USDT' };
    db.run("UPDATE wallets SET available = available - ? - ? WHERE user_id = ? AND coin_symbol = ?", [orderTotal, fee, user.id, 'USDT']);
    let cw = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, baseCoin]);
    if (!cw) {
      db.run("INSERT INTO wallets (user_id, coin_symbol, coin_name, available, frozen, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [user.id, baseCoin, baseCoin, 0, 0, '', 10]);
      cw = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, baseCoin]);
    }
    db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, baseCoin]);
  } else {
    const cw = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, baseCoin]);
    if (!cw || cw.available < amount) return { code: 400, data: null, msg: `Insufficient ${baseCoin}` };
    db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, baseCoin]);
    db.run("UPDATE wallets SET available = available + ? - ? WHERE user_id = ? AND coin_symbol = ?", [orderTotal, fee, user.id, 'USDT']);
  }

  db.run("INSERT INTO orders (user_id, order_no, order_type, side, symbol, price, amount, total, fee, status) VALUES (?, ?, 'spot', ?, ?, ?, ?, ?, ?, 'filled')",
    [user.id, orderNo, side, symbol, orderPrice, amount, orderTotal, fee]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, remark, order_no) VALUES (?, ?, ?, ?, ?, ?)",
    [user.id, side === 'buy' ? 'buy' : 'sell', side === 'buy' ? 'USDT' : baseCoin,
     side === 'buy' ? -(orderTotal + fee) : -amount, `${side} ${amount} ${baseCoin}`, orderNo]);
  saveDb();

  return { code: 200, data: { orderNo, symbol, side, price: orderPrice, amount, total: orderTotal, fee, status: 'filled' }, msg: 'success' };
}

function handleFuturesBuy(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { symbol, side, leverage, price, amount, margin } = body;
  if (!symbol || !amount || !margin) return { code: 400, data: null, msg: 'Invalid params' };
  const usdt = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, 'USDT']);
  if (!usdt || usdt.available < margin) return { code: 400, data: null, msg: 'Insufficient margin' };
  const fee = margin * config.FEE_RATE_FUTURES;
  const orderNo = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
  const db = getDbSync();
  db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [margin, user.id, 'USDT']);
  db.run("INSERT INTO positions (user_id, symbol, side, leverage, open_price, amount, margin, fee, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')",
    [user.id, symbol, side || 'long', leverage || 1, price || 0, amount, margin, fee]);
  saveDb();
  return { code: 200, data: { orderNo, symbol, side: side || 'long', margin, fee }, msg: 'success' };
}

function handleFuturesClose(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { id } = body;
  const pos = queryOne("SELECT * FROM positions WHERE user_id = ? AND id = ? AND status = 'open'", [user.id, id]);
  if (!pos) return { code: 400, data: null, msg: 'Position not found' };
  const pnl = pos.margin * ((Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.04 + 0.01));
  const ret = pos.margin + pnl;
  const db = getDbSync();
  db.run("UPDATE positions SET status = 'closed', closed_at = datetime('now'), pnl = ? WHERE id = ?", [pnl, id]);
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [ret, user.id, 'USDT']);
  saveDb();
  return { code: 200, data: { positionId: id, pnl: pnl.toFixed(2), returnAmount: ret.toFixed(2) }, msg: 'success' };
}

// ========== 订单 ==========

function handleTransactionCurrency(path, body, user) {
  if (!user) return { code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } } };
  const { page = 1, size = 10, symbol, status, type } = body;
  let where = "WHERE user_id = ? AND order_type = 'spot'", params = [user.id];
  if (symbol) { where += " AND symbol = ?"; params.push(symbol); }
  if (status) { where += " AND status = ?"; params.push(status); }
  if (type) { where += " AND side = ?"; params.push(type); }
  const records = queryAll(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM orders ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handlePositionDetail(path, body, user) {
  if (!user) return { code: 200, data: [] };
  const orders = queryAll("SELECT * FROM orders WHERE user_id = ? AND order_type = 'spot' AND status = 'filled'", [user.id]);
  return { code: 200, data: orders.map(o => ({ symbol: o.symbol, side: o.side, amount: o.amount, price: o.price })), msg: 'success' };
}

// ========== 工具 ==========

function formatUser(user, token) {
  return {
    id: String(user.id), userId: String(user.id),
    username: user.username || user.wallet_address || '',
    nickName: user.nick_name || '', avatar: user.avatar || '',
    email: user.email || '', phone: user.phone || '',
    walletAddress: user.wallet_address || '',
    inviteCode: user.invite_code || '',
    googleStatus: user.google_status || 0, status: user.status || 1,
    darkMode: user.dark_mode || 0, createTime: user.created_at,
    ...(token ? { token } : {})
  };
}

function generateCode() { return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase(); }

function createDefaultWallets(userId) {
  const db = getDbSync();
  const coins = [
    { s: 'USDT', n: 'Tether', i: 'icon-usdt', o: 1 },
    { s: 'BTC', n: 'Bitcoin', i: 'icon-btc', o: 2 },
    { s: 'ETH', n: 'Ethereum', i: 'icon-eth', o: 3 },
    { s: 'BNB', n: 'BNB', i: 'icon-bnb', o: 4 },
    { s: 'SOL', n: 'Solana', i: 'icon-sol', o: 5 },
    { s: 'XRP', n: 'XRP', i: 'icon-xrp', o: 6 },
  ];
  for (const c of coins) {
    try { db.run("INSERT INTO wallets (user_id, coin_symbol, coin_name, available, frozen, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, c.s, c.n, c.s === 'USDT' ? 10000 : 0, 0, c.i, c.o]); } catch(e) {}
  }
  try { db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, 'bonus', 'USDT', 10000, 10000, 'New user bonus']); } catch(e) {}
  saveDb();
}

module.exports = { match };

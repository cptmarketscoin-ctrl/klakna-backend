/**
 * sql.js 数据库封装 v3
 * 优化：lazy save，避免每次写操作都 flush 到磁盘
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DB_DIR = path.dirname(config.DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db = null;
let _dirty = false;   // 数据有修改，需要保存
let _lock = false;    // 防止并发保存

// 💾 加载数据库
async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(config.DB_PATH)) {
    const buf = fs.readFileSync(config.DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  createTables(db);
  return db;
}

// 📊 创建表结构
function createTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      wallet_address TEXT UNIQUE,
      nick_name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      invite_code TEXT UNIQUE DEFAULT '',
      invited_by TEXT DEFAULT '',
      google_secret TEXT DEFAULT '',
      google_status INTEGER DEFAULT 0,
      trading_password TEXT DEFAULT '',
      status INTEGER DEFAULT 1,
      dark_mode INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coin_symbol TEXT NOT NULL,
      coin_name TEXT NOT NULL,
      available REAL DEFAULT 0,
      frozen REAL DEFAULT 0,
      icon TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(user_id, coin_symbol)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS coin_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      base_coin TEXT NOT NULL,
      quote_coin TEXT NOT NULL,
      base_name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      icon TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_no TEXT UNIQUE NOT NULL,
      order_type TEXT NOT NULL DEFAULT 'spot',
      side TEXT NOT NULL DEFAULT 'buy',
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      total REAL NOT NULL,
      fee REAL DEFAULT 0,
      fee_coin TEXT DEFAULT 'USDT',
      status TEXT DEFAULT 'filled',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS flow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      coin_symbol TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      remark TEXT DEFAULT '',
      order_no TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      leverage INTEGER DEFAULT 1,
      open_price REAL NOT NULL,
      amount REAL NOT NULL,
      margin REAL NOT NULL,
      fee REAL DEFAULT 0,
      pnl REAL DEFAULT 0,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      close_price REAL
    )
  `);

  // 👑 确保 role 字段存在
  try { db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'"); } catch(e) {}

  // 🔒 确保 restrictions 字段存在（用户操作限制 JSON）
  try { db.run("ALTER TABLE users ADD COLUMN restrictions TEXT DEFAULT '{}'"); } catch(e) {}

  // ========== 新增：前端控制相关表 ==========

  // 前端注入规则（CSS/JS）
  db.run(`
    CREATE TABLE IF NOT EXISTS frontend_controls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,         -- 'css' | 'js'
      content TEXT NOT NULL,       -- 注入内容
      enabled INTEGER DEFAULT 1,
      scope TEXT DEFAULT 'global', -- 'global' | 'page:/trade' | 'user:123'
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 用户操作限制
  db.run(`
    CREATE TABLE IF NOT EXISTS user_restrictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      restrict_type TEXT NOT NULL,  -- 'no_trade' | 'no_withdraw' | 'force_kyc' | 'no_transfer'
      enabled INTEGER DEFAULT 1,
      reason TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 行情数据覆盖规则
  db.run(`
    CREATE TABLE IF NOT EXISTS market_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      data_type TEXT NOT NULL,
      override_config TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 控制指令日志
  db.run(`
    CREATE TABLE IF NOT EXISTS control_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_type TEXT NOT NULL,    -- 'popup' | 'redirect' | 'refresh' | 'inject' | 'block'
      target TEXT NOT NULL,          -- 'all' | 'user_id:123' | 'session:xxx'
      payload TEXT NOT NULL,         -- JSON
      status TEXT DEFAULT 'pending', -- 'pending' | 'sent' | 'failed' | 'expired'
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    )
  `);

  // 👑 创建 root 管理员
  const stmt = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (stmt.step()) {
    stmt.free();
  } else {
    stmt.free();
    const bcrypt = require('bcryptjs');
    const uuid = require('uuid').v4;
    const adminCode = uuid().replace(/-/g, '').substring(0, 8).toUpperCase();
    const hash = bcrypt.hashSync('admin888', 10);
    db.run(`INSERT INTO users (username, password, nick_name, role, invite_code, status)
            VALUES ('root', ?, 'Root Admin', 'admin', ?, 1)`, [hash, adminCode]);
    console.log('[DB] ✅ Root 管理员已创建 → 用户名: root, 密码: admin888');
  }

  markDirty();
}

// 💾 保存数据库到磁盘（lazy: 只在 dirty 时写入）
function saveDb() {
  if (!db || _lock) return;
  if (!_dirty) return;

  _lock = true;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.DB_PATH, buffer);
    _dirty = false;
  } catch(e) {
    console.error('[DB] 保存失败:', e.message);
  } finally {
    _lock = false;
  }
}

// 标记数据已修改
function markDirty() {
  _dirty = true;
}

// 定期自动保存（每 10 秒）
setInterval(() => saveDb(), 10000);

// 进程退出时保存
process.on('exit', () => saveDb());
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

module.exports = { getDb, saveDb, markDirty };

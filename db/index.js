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

  // ========== 充值记录表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS recharge_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coin_symbol TEXT NOT NULL DEFAULT 'USDT',
      amount REAL NOT NULL,
      network TEXT DEFAULT '',
      address TEXT DEFAULT '',
      tx_hash TEXT DEFAULT '',
      proof_image TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      admin_remark TEXT DEFAULT '',
      reviewed_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT
    )
  `);

  // ========== 提现记录表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS withdraw_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coin_symbol TEXT NOT NULL DEFAULT 'USDT',
      amount REAL NOT NULL,
      fee REAL DEFAULT 0,
      address TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_remark TEXT DEFAULT '',
      tx_hash TEXT DEFAULT '',
      reviewed_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT
    )
  `);

  // ========== Moonpay 配置表（单条配置）==========
  db.run(`
    CREATE TABLE IF NOT EXISTS moonpay_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id TEXT NOT NULL DEFAULT '',
      api_secret TEXT NOT NULL DEFAULT '',
      fee_type TEXT NOT NULL DEFAULT 'fixed',
      fee_rate REAL DEFAULT 0,
      min_deposit REAL DEFAULT 50,
      max_deposit REAL DEFAULT 10000,
      usdt_brl_rate REAL DEFAULT 5.0,
      status INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== Moonpay 订单表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS moonpay_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_no TEXT UNIQUE NOT NULL,
      trans_amount REAL NOT NULL,
      pay_currency TEXT DEFAULT 'BRL',
      pay_type TEXT DEFAULT '',
      callback_result TEXT DEFAULT '',
      order_status TEXT DEFAULT 'pending',
      actual_amount REAL DEFAULT 0,
      fee REAL DEFAULT 0,
      requested_usdt REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      user_received REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 指数配置表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS index_configures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      price REAL DEFAULT 0,
      change_24h REAL DEFAULT 0,
      change_percent REAL DEFAULT 0,
      volume_24h REAL DEFAULT 0,
      market_cap REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      remark TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 角色表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 权限表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 角色-权限关联表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )
  `);

  // ========== 菜单表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT,
      path TEXT,
      component TEXT,
      parent_id INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 角色-菜单关联表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS role_menus (
      role_id INTEGER NOT NULL,
      menu_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, menu_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
    )
  `);

  // ========== 用户-角色关联表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `);

  // ========== 操作日志表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      detail TEXT,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 实名认证表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS user_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      real_name TEXT NOT NULL,
      id_number TEXT NOT NULL,
      id_type TEXT DEFAULT 'id_card',
      front_image TEXT DEFAULT '',
      back_image TEXT DEFAULT '',
     手持_image TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      reject_reason TEXT DEFAULT '',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 登录日志表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT,
      ip TEXT,
      user_agent TEXT,
      login_time TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'success',
      fail_reason TEXT DEFAULT ''
    )
  `);

  // ========== 签到记录表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS checkin_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      checkin_date TEXT DEFAULT (date('now')),
      reward_amount REAL DEFAULT 0,
      reward_coin TEXT DEFAULT 'USDT',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, checkin_date)
    )
  `);

  // ========== 划转记录表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS transfer_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      from_coin TEXT NOT NULL,
      to_coin TEXT NOT NULL,
      from_amount REAL NOT NULL,
      to_amount REAL NOT NULL,
      fee REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now'))
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

  // ========== 为 coin_pairs 表添加缺少的字段 ==========
  try { db.run("ALTER TABLE coin_pairs ADD COLUMN withdraw_fee REAL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE coin_pairs ADD COLUMN min_withdraw REAL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE coin_pairs ADD COLUMN max_withdraw REAL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE coin_pairs ADD COLUMN publish_time TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE coin_pairs ADD COLUMN total_supply REAL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE coin_pairs ADD COLUMN circulating_supply REAL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE coin_pairs ADD COLUMN coin_content TEXT DEFAULT ''"); } catch(e) {}

  // ========== 风控管理：行情控制表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS market_control (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      max_price REAL DEFAULT 0,
      min_price REAL DEFAULT 0,
      action TEXT DEFAULT 'block',
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 风控管理：合约风控表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS contract_risk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      max_leverage INTEGER DEFAULT 10,
      max_position REAL DEFAULT 0,
      risk_level TEXT DEFAULT 'medium',
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 客服配置表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS customer_service (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Customer Service',
      avatar TEXT DEFAULT '',
      welcome_message TEXT DEFAULT 'Hello, how can I help you?',
      enabled INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 插入默认客服配置
  try {
    db.run(`INSERT INTO customer_service (name, welcome_message) VALUES ('Customer Service', 'Hello, how can I help you?')`);
  } catch(e) {}

  // ========== 钱包配置表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS wallet_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin_type TEXT NOT NULL,
      wallet_name TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      wallet_type TEXT NOT NULL DEFAULT 'central',
      private_key_encrypted TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 创建唯一索引，防止同一币种同一类型重复配置
  try { db.run("CREATE UNIQUE INDEX idx_wallet_config_type ON wallet_config(coin_type, wallet_type)"); } catch(e) {}

  // ========== 归集记录表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS collection_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coin_type TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount REAL DEFAULT 0,
      tx_hash TEXT DEFAULT '',
      gas_fee REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error_msg TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT ''
    )
  `);

  // ========== 客服消息表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS cs_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT DEFAULT '',
      message TEXT NOT NULL,
      reply TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      replied_at TEXT DEFAULT ''
    )
  `);

  // ========== 配置管理表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS config_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      value_type TEXT DEFAULT 'text',
      label TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(category, key)
    )
  `);

  // ========== 轮播图管理表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS homepage_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image_url TEXT NOT NULL,
      link_url TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      start_time TEXT,
      end_time TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 咨询项目管理表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS homepage_consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      image_url TEXT,
      category TEXT DEFAULT 'news',
      author TEXT,
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      is_top INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 文章分类表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS article_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 文章表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      cover_image TEXT,
      category_id INTEGER,
      author TEXT,
      status TEXT DEFAULT 'published',
      is_top INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ========== 代理管理表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      agent_level TEXT DEFAULT 'normal',
      agent_code TEXT UNIQUE,
      commission_rate REAL DEFAULT 0,
      total_referrals INTEGER DEFAULT 0,
      total_commission REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

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

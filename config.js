/**
 * Klakna 后端配置
 */

module.exports = {
  // 🖥️ 服务器端口
  PORT: 8080,
  HTTPS_PORT: 8443,

  // 🎯 原站地址（用于透传代理）
  TARGET: 'https://www.klakna.sbs',  // 生产站地址

  // 🔐 JWT 密钥
  JWT_SECRET: 'klakna_backend_secret_key_2024',
  JWT_EXPIRES_IN: '7d',

  // 💰 交易手续费率
  FEE_RATE: 0.001,        // 0.1%
  FEE_RATE_FUTURES: 0.0005, // 0.05%

  // 👑 管理员密钥（API 调用时通过 Authorization: Bearer admin:SECRET 鉴权）
  ADMIN_SECRET: 'klakna_admin_root_2024',

  // 📁 数据库文件
  DB_PATH: __dirname + '/data/klakna.db',

  // 📝 日志配置
  LOG: {
    DIR: __dirname + '/logs',
    MAX_SIZE: '20m',
    MAX_FILES: '14d',
    LEVEL: 'info',
  },

  // 🛡️ 速率限制配置
  RATE_LIMIT: {
    // 登录接口限制（更严格）
    LOGIN: {
      windowMs: 15 * 60 * 1000, // 15 分钟
      max: 5, // 最多 5 次尝试
      message: {
        code: 429,
        msg: 'Too many login attempts, please try again later',
        data: null,
      },
    },
    // 通用 API 限制
    API: {
      windowMs: 15 * 60 * 1000, // 15 分钟
      max: 100, // 最多 100 次请求
      message: {
        code: 429,
        msg: 'Too many requests, please try again later',
        data: null,
      },
    },
  },

  // 🌐 CORS 白名单
  CORS_WHITELIST: [
    'https://cptmarketscoin-ctrl.github.io',
    'http://localhost:3000',
    'http://localhost:8080',
    'https://localhost:8443',
    'http://127.0.0.1:8080',
    'https://127.0.0.1:8443',
    // 生产域名 - 根据需要添加
  ],
};

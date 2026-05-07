/**
 * Klakna 后端配置
 * 适配 Render 等云平台部署
 */

module.exports = {
  // 🖥️ 服务器端口（Render 等云平台通过 PORT 环境变量指定）
  PORT: process.env.PORT || 8080,
  HTTPS_PORT: process.env.HTTPS_PORT || 8443,

  // 🎯 原站地址（用于透传代理）
  TARGET: process.env.TARGET_URL || 'https://www.klakna.sbs',

  // 🔐 JWT 密钥（生产环境必须通过环境变量设置）
  JWT_SECRET: process.env.JWT_SECRET || 'klakna_backend_secret_key_2024',
  JWT_EXPIRES_IN: '7d',

  // 💰 交易手续费率
  FEE_RATE: 0.001,        // 0.1%
  FEE_RATE_FUTURES: 0.0005, // 0.05%

  // 👑 管理员密钥（API 调用时通过 Authorization: Bearer admin:SECRET 鉴权）
  ADMIN_SECRET: process.env.ADMIN_SECRET || 'klakna_admin_root_2024',

  // 📁 数据库文件（云平台使用 /tmp 保证可写）
  DB_PATH: process.env.DB_PATH || '/tmp/klakna.db',
};

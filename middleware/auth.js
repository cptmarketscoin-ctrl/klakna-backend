/**
 * JWT 认证中间件
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

// 🍞 签发 Token
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      walletAddress: user.wallet_address,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

// 🛡️ 认证中间件
function authRequired(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return next(); // 无 token 放行（某些接口可选登录）

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    // token 无效，放行但不设置 req.user
    next();
  }
}

// 🛡️ 强制认证中间件（必须有有效 token）
function authStrict(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) {
    return res.json({ code: 401, data: null, msg: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.json({ code: 401, data: null, msg: 'Token expired or invalid' });
  }
}

module.exports = { signToken, authRequired, authStrict };

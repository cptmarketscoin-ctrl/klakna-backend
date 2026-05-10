/**
 * 统一日志服务
 *
 * 功能：
 * - 按日期自动轮转日志文件
 * - 区分 error / warn / info / debug / http 级别
 * - error 日志单独存储
 * - 控制台彩色输出（开发环境）
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config');

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// 控制台格式（带颜色）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  logFormat
);

// 创建日志目录
const fs = require('fs');
if (!fs.existsSync(config.LOG.DIR)) {
  fs.mkdirSync(config.LOG.DIR, { recursive: true });
}

// HTTP 请求日志传输器（单独文件）
const httpRotateTransport = new DailyRotateFile({
  level: 'http',
  filename: path.join(config.LOG.DIR, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: config.LOG.MAX_SIZE,
  maxFiles: config.LOG.MAX_FILES,
  format: logFormat,
});

// 应用日志传输器（info 及以上）
const combinedRotateTransport = new DailyRotateFile({
  level: 'info',
  filename: path.join(config.LOG.DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: config.LOG.MAX_SIZE,
  maxFiles: config.LOG.MAX_FILES,
  format: logFormat,
});

// 错误日志传输器（单独文件）
const errorRotateTransport = new DailyRotateFile({
  level: 'error',
  filename: path.join(config.LOG.DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: config.LOG.MAX_SIZE,
  maxFiles: config.LOG.MAX_FILES,
  format: logFormat,
});

// 创建 logger 实例
const logger = winston.createLogger({
  level: config.LOG.LEVEL,
  transports: [
    httpRotateTransport,
    combinedRotateTransport,
    errorRotateTransport,
  ],
  // 未捕获异常也写入日志
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(config.LOG.DIR, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.LOG.MAX_SIZE,
      maxFiles: config.LOG.MAX_FILES,
      format: logFormat,
    })
  ],
  // 未处理的 Promise 拒绝也写入日志
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(config.LOG.DIR, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.LOG.MAX_SIZE,
      maxFiles: config.LOG.MAX_FILES,
      format: logFormat,
    })
  ],
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// HTTP 请求日志中间件
logger.httpMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`, {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  });
  next();
};

module.exports = logger;

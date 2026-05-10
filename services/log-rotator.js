/**
 * 日志轮转服务
 * 
 * 功能：
 * 1. 检查日志文件大小
 * 2. 超过10MB时自动轮转
 * 3. 保留最近5个日志文件
 * 4. 压缩旧日志文件
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

/**
 * 获取日志文件列表（按修改时间排序）
 */
function getLogFiles() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      return [];
    }
    
    return fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log') || f.endsWith('.log.gz'))
      .map(f => ({
        name: f,
        path: path.join(LOG_DIR, f),
        stat: fs.statSync(path.join(LOG_DIR, f))
      }))
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  } catch (e) {
    console.error('[LogRotator] Error reading log dir:', e.message);
    return [];
  }
}

/**
 * 轮转日志文件
 */
function rotateLog(logFilePath) {
  try {
    if (!fs.existsSync(logFilePath)) {
      return;
    }
    
    const stat = fs.statSync(logFilePath);
    if (stat.size < MAX_LOG_SIZE) {
      return; // 文件大小未超过限制，不需要轮转
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = path.basename(logFilePath, '.log');
    const rotatedName = `${baseName}.${timestamp}.log`;
    const rotatedPath = path.join(LOG_DIR, rotatedName);
    
    // 重命名当前日志文件
    fs.renameSync(logFilePath, rotatedPath);
    
    console.log(`[LogRotator] Rotated log: ${rotatedName} (${(stat.size / 1024 / 1024).toFixed(2)}MB)`);
    
    // 压缩轮转的日志文件（异步）
    compressFile(rotatedPath);
    
    return true;
  } catch (e) {
    console.error('[LogRotator] Error rotating log:', e.message);
    return false;
  }
}

/**
 * 压缩文件
 */
function compressFile(filePath) {
  try {
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(filePath + '.gz');
    const gzip = zlib.createGzip();
    
    readStream.pipe(gzip).pipe(writeStream);
    
    writeStream.on('finish', () => {
      fs.unlinkSync(filePath);
      console.log(`[LogRotator] Compressed: ${path.basename(filePath)}`);
    });
  } catch (e) {
    console.error('[LogRotator] Error compressing file:', e.message);
  }
}

/**
 * 清理旧日志文件（保留最近 MAX_LOG_FILES 个）
 */
function cleanupOldLogs() {
  try {
    const files = getLogFiles();
    
    if (files.length <= MAX_LOG_FILES) {
      return;
    }
    
    const toDelete = files.slice(MAX_LOG_FILES);
    toDelete.forEach(f => {
      try {
        fs.unlinkSync(f.path);
        console.log(`[LogRotator] Deleted old log: ${f.name}`);
      } catch (e) {
        console.error(`[LogRotator] Error deleting ${f.name}:`, e.message);
      }
    });
  } catch (e) {
    console.error('[LogRotator] Error cleaning up logs:', e.message);
  }
}

/**
 * 检查并轮转指定的日志文件
 */
function checkAndRotate(logFilePath) {
  try {
    rotateLog(logFilePath);
    cleanupOldLogs();
  } catch (e) {
    console.error('[LogRotator] Error in checkAndRotate:', e.message);
  }
}

/**
 * 启动日志轮转服务
 * @param {string} logFilePath - 要监控的日志文件路径
 * @param {number} interval - 检查间隔（毫秒，默认5分钟）
 */
function start(logFilePath, interval = 5 * 60 * 1000) {
  if (!logFilePath) {
    console.warn('[LogRotator] No log file path provided');
    return;
  }
  
  console.log(`[LogRotator] Started, monitoring: ${logFilePath}`);
  console.log(`[LogRotator] Max size: ${MAX_LOG_SIZE / 1024 / 1024}MB, Max files: ${MAX_LOG_FILES}`);
  
  // 立即检查一次
  checkAndRotate(logFilePath);
  
  // 定期检査
  setInterval(() => {
    checkAndRotate(logFilePath);
  }, interval);
}

module.exports = { start, checkAndRotate, getLogFiles };

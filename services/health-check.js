/**
 * 深度健康检查服务
 * 提供 /health/deep、/health/ready、/health/live 端点支持
 * 
 * 检查项目：
 * - 数据库连接
 * - 外部 API（CoinGecko）
 * - 磁盘空间
 * - 内存使用
 * - 熔断器状态
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getDb } = require('../db/index');
const priceFetcher = require('./price-fetcher');

// ============================================================
// 检查数据库连接
// ============================================================
async function checkDatabase() {
  try {
    const db = await getDb();
    // 执行简单查询测试连接
    const result = db.prepare('SELECT 1 as test').get();
    return {
      status: 'healthy',
      message: 'Database connection successful',
      details: { testResult: result?.test }
    };
  } catch (e) {
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      details: { error: e.message }
    };
  }
}

// ============================================================
// 检查外部 API（CoinGecko）
// ============================================================
async function checkExternalAPI() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.coingecko.com',
      path: '/api/v3/ping',
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'klakna-backend-health-check'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({
            status: 'healthy',
            message: 'CoinGecko API is accessible',
            details: { statusCode: res.statusCode }
          });
        } else {
          resolve({
            status: 'degraded',
            message: `CoinGecko API returned ${res.statusCode}`,
            details: { statusCode: res.statusCode }
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 'unhealthy',
        message: 'CoinGecko API is not accessible',
        details: { error: err.message }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'degraded',
        message: 'CoinGecko API timeout',
        details: { timeout: options.timeout }
      });
    });

    req.end();
  });
}

// ============================================================
// 检查磁盘空间
// ============================================================
function checkDiskSpace() {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // 尝试写入测试文件
    const testFile = path.join(logDir, '.health-check-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    return {
      status: 'healthy',
      message: 'Disk is writable',
      details: { logDir }
    };
  } catch (e) {
    return {
      status: 'unhealthy',
      message: 'Disk check failed',
      details: { error: e.message }
    };
  }
}

// ============================================================
// 检查内存使用
// ============================================================
function checkMemory() {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  
  // 堆内存使用超过 80% 视为降级
  const heapUsedPercent = (mem.heapUsed / mem.heapTotal) * 100;
  let status = 'healthy';
  let message = 'Memory usage normal';
  
  if (heapUsedPercent > 90) {
    status = 'unhealthy';
    message = 'Memory usage critical';
  } else if (heapUsedPercent > 80) {
    status = 'degraded';
    message = 'Memory usage high';
  }
  
  return {
    status,
    message,
    details: {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      heapUsedPercent: Math.round(heapUsedPercent * 100) / 100
    }
  };
}

// ============================================================
// 检查熔断器状态
// ============================================================
function checkCircuitBreaker() {
  try {
    const status = priceFetcher.getStatus();
    let breakerStatus = 'healthy';
    let message = 'Circuit breaker is closed';
    
    if (status.circuitState === 'OPEN') {
      breakerStatus = 'degraded';
      message = 'Circuit breaker is open (API failures)';
    }
    
    return {
      status: breakerStatus,
      message,
      details: status
    };
  } catch (e) {
    return {
      status: 'unknown',
      message: 'Circuit breaker status unavailable',
      details: { error: e.message }
    };
  }
}

// ============================================================
// 深度健康检查（综合所有检查）
// ============================================================
async function deepHealthCheck() {
  const checks = {
    database: await checkDatabase(),
    externalAPI: await checkExternalAPI(),
    disk: checkDiskSpace(),
    memory: checkMemory(),
    circuitBreaker: checkCircuitBreaker()
  };
  
  // 判断整体健康状态
  const statuses = Object.values(checks).map(c => c.status);
  let overallStatus = 'healthy';
  
  if (statuses.includes('unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
  }
  
  const httpStatus = overallStatus === 'healthy' ? 200 :
                    overallStatus === 'degraded' ? 200 : 503;
  
  return {
    status: httpStatus,
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      checks
    }
  };
}

// ============================================================
// 就绪检查（用于 K8s readinessProbe）
// ============================================================
async function readinessCheck() {
  // 检查关键依赖是否就绪
  const dbCheck = await checkDatabase();
  const isReady = dbCheck.status === 'healthy';
  
  return {
    status: isReady ? 200 : 503,
    data: {
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck.status
      }
    }
  };
}

// ============================================================
// 存活检查（用于 K8s livenessProbe）
// ============================================================
function livenessCheck() {
  // 简单检查进程是否活着
  return {
    status: 200,
    data: {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      pid: process.pid
    }
  };
}

module.exports = {
  deepHealthCheck,
  readinessCheck,
  livenessCheck,
  checkDatabase,
  checkExternalAPI,
  checkDiskSpace,
  checkMemory,
  checkCircuitBreaker
};

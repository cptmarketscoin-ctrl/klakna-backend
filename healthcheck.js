// healthcheck.js - Docker 健康检查脚本
const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);  // 健康
  } else {
    process.exit(1);  // 不健康
  }
});

request.on('error', (err) => {
  console.error('Healthcheck failed:', err.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.error('Healthcheck timeout');
  request.destroy();
  process.exit(1);
});

request.end();

// test-start.js - 简单测试启动脚本
console.log('[TEST] 开始测试 server.js...');

try {
  // 尝试加载 server.js
  require('./server.js');
  console.log('[TEST] ✅ server.js 加载成功');
} catch (e) {
  console.error('[TEST] ❌ 加载失败:', e.message);
  console.error(e.stack);
  process.exit(1);
}

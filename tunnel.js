const localtunnel = require('localtunnel');

async function start() {
  console.log('🔗 正在连接 localtunnel...');
  
  const tunnel = await localtunnel({ 
    port: 8080,
    allow_invalid_cert: true
  });
  
  console.log('\n✅ 隧道已建立！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 公网地址: ' + tunnel.url);
  console.log('📌 本地后端: http://localhost:8080');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n测试: curl ' + tunnel.url + '/health');
  
  tunnel.on('close', () => {
    console.log('\n⚠️ 隧道已关闭');
    process.exit(0);
  });
}

start().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('✅ 后端服务正常运行！');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 测试服务器启动成功！`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

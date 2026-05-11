// 简化版 PnL 诊断脚本
// 只检查：1) 价格缓存 2) 本地 API 是否工作 3) 认证方式

const http = require('http');

const BASE_URL = 'http://localhost:8080';

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function diagnose() {
  console.log('=== PnL 诊断脚本 ===\n');

  // 1. 检查价格缓存（通过管理员 API 或特殊端点）
  console.log('1. 检查系统状态...');
  
  // 尝试访问一个公开的价格API（如果有的话）
  try {
    const priceRes = await request('GET', '/api/getPrice?symbol=BTC-USDT');
    console.log('价格API响应:', JSON.stringify(priceRes.data, null, 2));
  } catch (e) {
    console.log('价格API错误:', e.message);
  }

  // 2. 测试登录
  console.log('\n2. 测试登录...');
  const loginRes = await request('POST', '/exchange/user/login', {
    username: 'root',
    password: 'admin888'
  });
  
  console.log('登录响应:', JSON.stringify(loginRes.data, null, 2));
  
  if (loginRes.data.code === 200) {
    const token = loginRes.data.data.token;
    console.log('✅ 登录成功');
    console.log('Token:', token.substring(0, 50) + '...');
    
    // 3. 使用 token 测试获取价格
    console.log('\n3. 测试获取价格（带认证）...');
    const priceAuthRes = await request('GET', '/api/getPrice?symbol=BTC-USDT', null, {
      'Authorization': `Bearer ${token}`
    });
    console.log('价格响应:', JSON.stringify(priceAuthRes.data, null, 2));
    
    // 4. 测试开仓 API（不带 /api 前缀）
    console.log('\n4. 测试开仓 API...');
    const buyRes = await request('POST', '/exchange/rockieCoinFutures/buy', {
      symbol: 'BTC-USDT',
      direction: 'buy',
      amount: 100,
      leverage: 10,
      orderType: 'market'
    }, {
      'Authorization': `Bearer ${token}`
    });
    console.log('开仓响应:', JSON.stringify(buyRes.data, null, 2));
    
  } else {
    console.log('❌ 登录失败');
  }

  // 5. 检查服务器日志（如果能访问）
  console.log('\n5. 建议手动检查:');
  console.log('   - 查看服务器控制台输出');
  console.log('   - 确认 global.__priceCache 是否有数据');
  console.log('   - 确认 /exchange/rockieCoinFutures/buy 是否正确路由到本地处理器');
}

diagnose().catch(console.error);

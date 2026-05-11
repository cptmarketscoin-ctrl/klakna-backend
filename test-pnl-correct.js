// 正确的 PnL 测试脚本
const http = require('http');

const BASE_URL = 'http://localhost:8080';

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

async function testPnl() {
  console.log('=== 正确测试 PnL 计算 ===\n');

  // 1. 登录
  console.log('1. 登录...');
  const loginRes = await request('POST', '/exchange/user/login', {
    username: 'root',
    password: 'admin888'
  });
  
  if (loginRes.data.code !== 200) {
    console.log('❌ 登录失败:', loginRes.data.msg);
    return;
  }
  
  const token = loginRes.data.data.token;
  console.log('✅ 登录成功');
  console.log('   Token:', token.substring(0, 50) + '...\n');

  // 2. 获取实时价格（正确路径和符号格式）
  console.log('2. 获取 BTCUSDT 实时价格...');
  const priceRes = await request('POST', '/exchange/rockieCoinFutures/getPrice', {
    symbol: 'BTCUSDT'
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   响应:', JSON.stringify(priceRes.data, null, 2));
  
  if (priceRes.data.symbol && priceRes.data.price) {
    console.log(`✅ 价格获取成功: ${priceRes.data.symbol} = $${priceRes.data.price}\n`);
  } else {
    console.log('❌ 价格获取失败\n');
  }

  // 3. 开仓
  console.log('3. 开仓 BTCUSDT buy 10x...');
  const openRes = await request('POST', '/exchange/rockieCoinFutures/futuresBuy', {
    symbol: 'BTC-USDT',
    direction: 'buy',
    amount: 100,
    leverage: 10,
    orderType: 'market'
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   响应:', JSON.stringify(openRes.data, null, 2));
  
  let positionId = null;
  if (openRes.data.code === 200) {
    console.log('✅ 开仓成功');
    const openPrice = openRes.data.data?.price || openRes.data.price;
    positionId = openRes.data.data?.id;
    console.log(`   开仓价格: $${openPrice}`);
    console.log(`   持仓ID: ${positionId}\n`);
  } else {
    console.log('❌ 开仓失败\n');
  }

  // 4. 等待价格变动
  console.log('4. 等待 5 秒（让价格变动）...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('');

  // 5. 平仓
  if (positionId) {
    console.log('5. 平仓...');
    const closeRes = await request('POST', '/exchange/rockieCoinFutures/futuresClose', {
      positionId: positionId,
      symbol: 'BTCUSDT'
    }, {
      'Authorization': `Bearer ${token}`
    });
    
    console.log('   响应:', JSON.stringify(closeRes.data, null, 2));
    
    if (closeRes.data.code === 200) {
      console.log('✅ 平仓成功');
      const closePrice = closeRes.data.data?.closePrice || closeRes.data.closePrice;
      const pnl = closeRes.data.data?.pnl || closeRes.data.pnl;
      console.log(`   平仓价格: $${closePrice}`);
      console.log(`   PnL: $${pnl}\n`);
    } else {
      console.log('❌ 平仓失败\n');
    }
  }

  console.log('=== 测试完成 ===');
}

testPnl().catch(err => {
  console.error('测试错误:', err.message);
  console.error(err.stack);
});

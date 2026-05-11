// 正确的 PnL 测试脚本 v2
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
  console.log('=== 正确测试 PnL 计算 v2 ===\n');

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
  console.log('✅ 登录成功\n');

  // 2. 获取实时价格
  console.log('2. 获取 BTCUSDT 实时价格...');
  const priceRes = await request('POST', '/exchange/rockieCoinFutures/getPrice', {
    symbol: 'BTCUSDT'
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   响应:', JSON.stringify(priceRes.data));
  
  if (priceRes.data.symbol && priceRes.data.price) {
    console.log(`✅ 价格获取成功: ${priceRes.data.symbol} = $${priceRes.data.price}\n`);
  } else {
    console.log('❌ 价格获取失败\n');
  }

  // 3. 开仓
  console.log('3. 开仓 BTCUSDT long 10x...');
  console.log('   参数: amount=0.001 BTC, margin=100 USDT, leverage=10x');
  
  const openRes = await request('POST', '/exchange/rockieCoinFutures/futuresBuy', {
    symbol: 'BTCUSDT',
    side: 'long',
    amount: 0.001,     // 持仓数量：0.001 BTC
    margin: 100,         // 保证金：100 USDT
    leverage: 10
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   响应:', JSON.stringify(openRes.data, null, 2));
  
  let positionId = null;
  if (openRes.data.code === 200) {
    console.log('✅ 开仓成功');
    const openPrice = openRes.data.data.openPrice;
    positionId = openRes.data.data.orderNo;  // 使用 orderNo 作为持仓ID
    console.log(`   开仓价格: $${openPrice}`);
    console.log(`   订单号/持仓ID: ${positionId}\n`);
  } else {
    console.log('❌ 开仓失败\n');
    return;
  }

  // 4. 等待价格变动
  console.log('4. 等待 5 秒（让价格变动）...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('');

  // 5. 获取新价格
  console.log('5. 获取平仓前价格...');
  const priceRes2 = await request('POST', '/exchange/rockieCoinFutures/getPrice', {
    symbol: 'BTCUSDT'
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  if (priceRes2.data.price) {
    console.log(`   新价格: $${priceRes2.data.price}\n`);
  }

  // 6. 平仓
  console.log('6. 平仓...');
  const closeRes = await request('POST', '/exchange/rockieCoinFutures/futuresClose', {
    id: positionId  // 使用 orderNo/position ID
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   响应:', JSON.stringify(closeRes.data, null, 2));
  
  if (closeRes.data.code === 200) {
    console.log('✅ 平仓成功');
    const result = closeRes.data.data;
    console.log(`   开仓价格: $${result.openPrice}`);
    console.log(`   平仓价格: $${result.closePrice}`);
    console.log(`   PnL: $${result.pnl}`);
    console.log(`   返还金额: $${result.returnAmount}\n`);
    
    // 7. 验证 PnL 计算
    console.log('7. 验证 PnL 计算...');
    const openPrice = parseFloat(result.openPrice);
    const closePrice = parseFloat(result.closePrice);
    const pnl = parseFloat(result.pnl);
    
    // long 仓位：PnL = (平仓价 - 开仓价) * 数量 * 杠杆 - 手续费
    const expectedPnl = (closePrice - openPrice) * 0.001 * 10;
    console.log(`   预期 PnL: $${expectedPnl.toFixed(2)}`);
    console.log(`   实际 PnL: $${pnl}`);
    
    if (Math.abs(expectedPnl - pnl) < 1) {
      console.log('   ✅ PnL 计算正确！');
    } else {
      console.log('   ⚠️ PnL 计算可能有误');
    }
  } else {
    console.log('❌ 平仓失败\n');
  }

  console.log('\n=== 测试完成 ===');
}

testPnl().catch(err => {
  console.error('测试错误:', err.message);
  console.error(err.stack);
});

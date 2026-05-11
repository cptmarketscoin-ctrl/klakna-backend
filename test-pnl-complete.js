// 完整的 PnL 测试：注册新用户 → 获得测试金 → 测试 PnL
const http = require('http');

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

async function testPnlComplete() {
  console.log('=== 完整 PnL 测试（新用户）===\n');

  // 1. 注册新用户
  console.log('1. 注册新用户...');
  const username = `test_pnl_${Date.now()}`;
  const password = 'test123456';
  
  const regRes = await request('POST', '/exchange/user/register', {
    username: username,
    password: password,
    email: `${username}@example.com`
  });
  
  console.log('   响应:', JSON.stringify(regRes.data).substring(0, 200));
  
  if (regRes.data.code !== 200) {
    console.log('\n❌ 注册失败，尝试登录已有账号...');
    // 如果注册失败（用户已存在），直接登录
  } else {
    console.log('\n✅ 注册成功');
  }

  // 2. 登录
  console.log('\n2. 登录...');
  const loginRes = await request('POST', '/exchange/user/login', {
    username: username,
    password: password
  });
  
  if (loginRes.data.code !== 200) {
    console.log('❌ 登录失败:', loginRes.data.msg);
    return;
  }
  
  const token = loginRes.data.data.token;
  console.log('✅ 登录成功\n');

  // 3. 检查钱包余额
  console.log('3. 检查钱包余额...');
  const walletRes = await request('POST', '/exchange/wallet/getUserWallet', {}, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   钱包信息:', JSON.stringify(walletRes.data).substring(0, 300));
  
  if (walletRes.data.code === 200 && walletRes.data.data) {
    const wallets = walletRes.data.data;
    if (Array.isArray(wallets)) {
      const usdt = wallets.find(w => w.coin_symbol === 'USDT' || w.coin === 'USDT');
      if (usdt) {
        console.log(`   USDT 可用余额: $${usdt.available}`);
        console.log(`   USDT 冻结余额: $${usdt.frozen || 0}\n`);
      }
    }
  }

  // 4. 获取实时价格
  console.log('4. 获取 BTCUSDT 实时价格...');
  const priceRes = await request('POST', '/exchange/rockieCoinFutures/getPrice', {
    symbol: 'BTCUSDT'
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   价格:', JSON.stringify(priceRes.data));
  const openPrice = priceRes.data.price ? parseFloat(priceRes.data.price) : 0;
  console.log(`   开仓前价格: $${openPrice}\n`);

  // 5. 开仓
  const margin = 100;  // 100 USDT 保证金
  const leverage = 10;
  const amount = 0.001;  // 0.001 BTC
  
  console.log(`5. 开仓 BTCUSDT long ${leverage}x...`);
  console.log(`   保证金: $${margin}, 数量: ${amount} BTC\n`);
  
  const openRes = await request('POST', '/exchange/rockieCoinFutures/futuresBuy', {
    symbol: 'BTCUSDT',
    side: 'long',
    amount: amount,
    margin: margin,
    leverage: leverage
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   响应:', JSON.stringify(openRes.data, null, 2));
  
  let positionId = null;
  if (openRes.data.code === 200) {
    console.log('\n✅ 开仓成功');
    const data = openRes.data.data;
    positionId = data.positionId;  // 使用数据库 ID
    orderNo = data.orderNo;
    console.log(`   订单号: ${orderNo}`);
    console.log(`   持仓ID: ${positionId}`);
    console.log(`   开仓价格: $${data.openPrice}`);
    console.log(`   保证金: $${data.margin}`);
    console.log(`   手续费: $${data.fee}\n`);
  } else {
    console.log('\n❌ 开仓失败:', openRes.data.msg);
    return;
  }

  // 6. 等待价格变动
  console.log('6. 等待 5 秒（让价格变动）...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 7. 获取新价格
  console.log('7. 获取平仓前价格...');
  const priceRes2 = await request('POST', '/exchange/rockieCoinFutures/getPrice', {
    symbol: 'BTCUSDT'
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  const closePrice = priceRes2.data.price ? parseFloat(priceRes2.data.price) : 0;
  console.log(`   平仓前价格: $${closePrice}`);
  console.log(`   价格变动: $${(closePrice - openPrice).toFixed(2)}\n`);

  // 8. 平仓
  console.log('8. 平仓...');
  const closeRes = await request('POST', '/exchange/rockieCoinFutures/futuresClose', {
    id: positionId  // 使用数据库 ID
  }, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('   响应:', JSON.stringify(closeRes.data, null, 2));
  
  if (closeRes.data.code === 200) {
    console.log('\n✅ 平仓成功');
    const result = closeRes.data.data;
    console.log(`   开仓价格: $${result.openPrice}`);
    console.log(`   平仓价格: $${result.closePrice}`);
    console.log(`   PnL: $${result.pnl}`);
    console.log(`   返还金额: $${result.returnAmount}\n`);
    
    // 9. 验证 PnL 计算
    console.log('9. 验证 PnL 计算...');
    const expectedPnl = (closePrice - openPrice) * amount * leverage;
    console.log(`   预期 PnL: $${expectedPnl.toFixed(2)}`);
    console.log(`   实际 PnL: $${result.pnl}`);
    
    if (Math.abs(expectedPnl - parseFloat(result.pnl)) < 1) {
      console.log('   ✅ PnL 计算正确！');
    } else {
      console.log('   ⚠️ PnL 计算可能有误');
    }
  } else {
    console.log('\n❌ 平仓失败:', closeRes.data.msg);
  }

  console.log('\n=== 测试完成 ===');
}

testPnlComplete().catch(err => {
  console.error('测试错误:', err.message);
  console.error(err.stack);
});

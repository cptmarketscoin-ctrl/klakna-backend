// PnL 计算测试脚本
// 测试流程：注册 → 登录 → 开仓 → 等待价格变动 → 平仓 → 验证 PnL

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:8080';
let authToken = '';
let testUser = {
  username: `test_pnl_${Date.now()}`,
  password: 'test123456',
  email: `test_${Date.now()}@example.com`
};

// 辅助函数：发送 HTTP 请求
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

// 1. 注册用户
async function register() {
  console.log('\n=== 1. 注册用户 ===');
  console.log(`用户名: ${testUser.username}`);
  
  const res = await request('POST', '/exchange/user/registerAdd', {
    username: testUser.username,
    password: testUser.password,
    email: testUser.email
  });
  
  console.log('响应:', JSON.stringify(res.data, null, 2));
  
  if (res.data.code === 200 || res.data.code === 0) {
    console.log('✅ 注册成功');
    return true;
  } else {
    console.log('❌ 注册失败');
    return false;
  }
}

// 2. 登录（使用管理员账号或测试账号）
async function login() {
  console.log('\n=== 2. 登录 ===');
  
  // 尝试使用管理员账号
  const res = await request('POST', '/exchange/user/login', {
    username: 'root',
    password: 'admin888'
  });
  
  console.log('响应:', JSON.stringify(res.data, null, 2));
  
  if (res.data.code === 200 || res.data.code === 0) {
    // 提取 token（可能在不同字段）
    authToken = res.data.data?.token || res.data.token || res.data.data?.authorization || 'admin:klakna_admin_root_2024';
    console.log('✅ 登录成功（管理员）');
    console.log(`Token: ${authToken ? authToken.substring(0, 30) + '...' : '未找到'}`);
    return true;
  } else {
    console.log('❌ 登录失败，尝试直接注册新用户...');
    // 如果管理员登录失败，注册新用户
    const regRes = await register();
    if (regRes) {
      // 注册成功后，某些系统会自动登录或返回 token
      authToken = 'test-token'; // 需要根据实际响应调整
      return true;
    }
    return false;
  }
}

// 3. 获取实时价格
async function getPrice(symbol = 'BTC-USDT') {
  console.log(`\n=== 3. 获取 ${symbol} 实时价格 ===`);
  
  const res = await request('GET', `/exchange/getPrice?symbol=${symbol}`, null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  console.log('响应:', JSON.stringify(res.data, null, 2));
  
  if (res.data.code === 200) {
    const price = res.data.data?.price || res.data.price;
    console.log(`✅ 当前价格: $${price}`);
    return price;
  } else {
    console.log('❌ 获取价格失败');
    return null;
  }
}

// 4. 开仓
async function openPosition(symbol = 'BTC-USDT', direction = 'buy', leverage = 10) {
  console.log(`\n=== 4. 开仓 ${symbol} ${direction} ${leverage}x ===`);
  
  const res = await request('POST', '/exchange/rockieCoinFutures/buy', {
    symbol: symbol,
    direction: direction,
    amount: 100,  // 100 USDT
    leverage: leverage,
    orderType: 'market'
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  console.log('响应:', JSON.stringify(res.data, null, 2));
  
  if (res.data.code === 200) {
    console.log('✅ 开仓成功');
    const openPrice = res.data.data?.price || res.data.price;
    console.log(`开仓价格: $${openPrice}`);
    return { success: true, openPrice, positionId: res.data.data?.id };
  } else {
    console.log('❌ 开仓失败');
    return { success: false };
  }
}

// 5. 平仓
async function closePosition(positionId, symbol = 'BTC-USDT') {
  console.log(`\n=== 5. 平仓 ${symbol} ===`);
  
  const res = await request('POST', '/exchange/rockieCoinFutures/close', {
    positionId: positionId,
    symbol: symbol
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  console.log('响应:', JSON.stringify(res.data, null, 2));
  
  if (res.data.code === 200) {
    console.log('✅ 平仓成功');
    const closePrice = res.data.data?.closePrice || res.data.closePrice;
    const pnl = res.data.data?.pnl || res.data.pnl;
    console.log(`平仓价格: $${closePrice}`);
    console.log(`PnL: $${pnl}`);
    return { success: true, closePrice, pnl };
  } else {
    console.log('❌ 平仓失败');
    return { success: false };
  }
}

// 6. 查询持仓记录（验证 PnL）
async function checkPositions(symbol = 'BTC-USDT') {
  console.log(`\n=== 6. 查询 ${symbol} 持仓记录 ===`);
  
  const res = await request('GET', `/exchange/rockieCoinFutures/records?symbol=${symbol}`, null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  console.log('响应:', JSON.stringify(res.data, null, 2));
  
  if (res.data.code === 200) {
    console.log('✅ 查询成功');
    return res.data.data;
  } else {
    console.log('❌ 查询失败');
    return null;
  }
}

// 主测试流程
async function runTest() {
  try {
    console.log('开始 PnL 计算测试...');
    console.log('测试用户:', testUser.username);
    
    // 1. 注册
    if (!await register()) {
      console.log('尝试直接登录（用户可能已存在）');
      if (!await login()) {
        throw new Error('无法注册或登录');
      }
    } else {
      // 2. 登录
      if (!await login()) {
        throw new Error('登录失败');
      }
    }
    
    // 3. 获取开仓前价格
    const priceBefore = await getPrice('BTC-USDT');
    
    // 4. 开仓
    const openResult = await openPosition('BTC-USDT', 'buy', 10);
    if (!openResult.success) {
      throw new Error('开仓失败');
    }
    
    // 等待 5 秒，让价格有可能变动
    console.log('\n等待 5 秒（模拟价格变动）...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 5. 获取平仓前价格
    const priceAfter = await getPrice('BTC-USDT');
    
    // 6. 平仓
    const closeResult = await closePosition(openResult.positionId, 'BTC-USDT');
    if (!closeResult.success) {
      throw new Error('平仓失败');
    }
    
    // 7. 验证 PnL 计算
    console.log('\n=== 7. 验证 PnL 计算 ===');
    console.log(`开仓价格: $${openResult.openPrice}`);
    console.log(`平仓价格: $${closeResult.closePrice}`);
    console.log(`实际价格变动: $${priceBefore} → $${priceAfter}`);
    
    // 计算预期 PnL
    const amount = 100;
    const leverage = 10;
    const expectedPnl = (closeResult.closePrice - openResult.openPrice) * (amount / openResult.openPrice) * leverage;
    
    console.log(`预期 PnL: $${expectedPnl.toFixed(2)}`);
    console.log(`实际 PnL: $${closeResult.pnl}`);
    
    if (Math.abs(expectedPnl - closeResult.pnl) < 1) {
      console.log('✅ PnL 计算正确！');
    } else {
      console.log('❌ PnL 计算可能有误');
    }
    
    // 8. 查询持仓记录
    await checkPositions('BTC-USDT');
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
runTest();

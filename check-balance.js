// 检查钱包余额
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

async function checkBalance() {
  // 1. 登录
  const loginRes = await request('POST', '/exchange/user/login', {
    username: 'root',
    password: 'admin888'
  });
  
  if (loginRes.data.code !== 200) {
    console.log('❌ 登录失败');
    return;
  }
  
  const token = loginRes.data.data.token;
  console.log('✅ 登录成功\n');
  
  // 2. 获取钱包信息
  const walletRes = await request('POST', '/exchange/wallet/getUserWallet', {}, {
    'Authorization': `Bearer ${token}`
  });
  
  console.log('钱包信息:');
  console.log(JSON.stringify(walletRes.data, null, 2));
  
  if (walletRes.data.code === 200 && walletRes.data.data) {
    const wallets = walletRes.data.data;
    console.log('\nUSDT 钱包:');
    if (Array.isArray(wallets)) {
      const usdt = wallets.find(w => w.coin_symbol === 'USDT' || w.coin === 'USDT');
      if (usdt) {
        console.log('  可用余额:', usdt.available);
        console.log('  冻结余额:', usdt.frozen);
      }
    }
  }
}

checkBalance().catch(console.error);

/**
 * KLAKNA 充值/提现功能 - 前端界面组件
 * 注入到原站前端，提供充值/提现功能
 */

(function() {
  'use strict';

  // ========== 配置 ==========
  const CONFIG = {
    apiBase: '',  // 同源API
    pollInterval: 10000,  // 轮询间隔（毫秒）
  };

  // ========== 全局变量 ==========
  let isInitialized = false;

  // ========== 初始化 ==========
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    console.log('[KLAKNA Recharge/Withdraw] 初始化...');

    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addButtons);
    } else {
      addButtons();
    }
  }

  // ========== 添加充值/提现按钮 ==========
  function addButtons() {
    // 创建充值按钮
    const rechargeBtn = document.createElement('button');
    rechargeBtn.id = 'klakna-recharge-btn';
    rechargeBtn.innerHTML = '充值';
    rechargeBtn.style.cssText = 'position:fixed;right:20px;bottom:120px;padding:10px 20px;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;z-index:10001;';
    rechargeBtn.onclick = showRechargeDialog;
    document.body.appendChild(rechargeBtn);

    // 创建提现按钮
    const withdrawBtn = document.createElement('button');
    withdrawBtn.id = 'klakna-withdraw-btn';
    withdrawBtn.innerHTML = '提现';
    withdrawBtn.style.cssText = 'position:fixed;right:20px;bottom:80px;padding:10px 20px;background:#ff4d4f;color:#fff;border:none;border-radius:4px;cursor:pointer;z-index:10001;';
    withdrawBtn.onclick = showWithdrawDialog;
    document.body.appendChild(withdrawBtn);

    // 创建记录按钮
    const recordsBtn = document.createElement('button');
    recordsBtn.id = 'klakna-records-btn';
    recordsBtn.innerHTML = '记录';
    recordsBtn.style.cssText = 'position:fixed;right:20px;bottom:40px;padding:10px 20px;background:#52c41a;color:#fff;border:none;border-radius:4px;cursor:pointer;z-index:10001;';
    recordsBtn.onclick = showRecordsDialog;
    document.body.appendChild(recordsBtn);

    console.log('[KLAKNA Recharge/Withdraw] 按钮已添加');
  }

  // ========== 显示充值弹窗 ==========
  window.showRechargeDialog = function() {
    const dialog = document.createElement('div');
    dialog.id = 'klakna-recharge-dialog';
    dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2147483647;';
    dialog.innerHTML = `
      <div style="background:#fff;padding:24px;border-radius:8px;width:400px;max-width:90%;">
        <h3 style="margin:0 0 16px 0;">充值申请</h3>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;">币种</label>
          <select id="recharge-coin" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;">
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;">充值金额</label>
          <input type="number" id="recharge-amount" placeholder="请输入充值金额" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;">交易哈希（可选）</label>
          <input type="text" id="recharge-tx-hash" placeholder="请输入交易哈希" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;margin-bottom:4px;">备注（可选）</label>
          <textarea id="recharge-remark" placeholder="请输入备注" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;"></textarea>
        </div>
        <div style="text-align:right;">
          <button onclick="document.getElementById('klakna-recharge-dialog').remove()" style="padding:8px 16px;margin-right:8px;border:1px solid #d9d9d9;background:#fff;cursor:pointer;border-radius:4px;">取消</button>
          <button onclick="submitRecharge()" style="padding:8px 16px;background:#1890ff;color:#fff;border:none;cursor:pointer;border-radius:4px;">提交</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
  };

  // ========== 提交充值申请 ==========
  window.submitRecharge = function() {
    const coinSymbol = document.getElementById('recharge-coin').value;
    const amount = document.getElementById('recharge-amount').value;
    const txHash = document.getElementById('recharge-tx-hash').value;
    const remark = document.getElementById('recharge-remark').value;

    if (!amount || parseFloat(amount) <= 0) {
      alert('请输入有效的充值金额');
      return;
    }

    const token = localStorage.getItem('token') || '';

    fetch('/api/recharge/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        coin_symbol: coinSymbol,
        amount: parseFloat(amount),
        tx_hash: txHash,
        remark: remark,
      }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        alert('充值申请提交成功！');
        document.getElementById('klakna-recharge-dialog').remove();
      } else {
        alert('提交失败：' + (data.msg || '未知错误'));
      }
    })
    .catch(err => {
      console.error('[KLAKNA] 充值申请失败:', err);
      alert('提交失败，请稍后重试');
    });
  };

  // ========== 显示提现弹窗 ==========
  window.showWithdrawDialog = function() {
    const dialog = document.createElement('div');
    dialog.id = 'klakna-withdraw-dialog';
    dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2147483647;';
    dialog.innerHTML = `
      <div style="background:#fff;padding:24px;border-radius:8px;width:400px;max-width:90%;">
        <h3 style="margin:0 0 16px 0;">提现申请</h3>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;">币种</label>
          <select id="withdraw-coin" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;">
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;">提现金额</label>
          <input type="number" id="withdraw-amount" placeholder="请输入提现金额" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;">提现地址</label>
          <input type="text" id="withdraw-address" placeholder="请输入提现地址" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;">手续费</label>
          <input type="number" id="withdraw-fee" placeholder="请输入手续费" value="1" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;margin-bottom:4px;">备注（可选）</label>
          <textarea id="withdraw-remark" placeholder="请输入备注" style="width:100%;padding:8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;"></textarea>
        </div>
        <div style="text-align:right;">
          <button onclick="document.getElementById('klakna-withdraw-dialog').remove()" style="padding:8px 16px;margin-right:8px;border:1px solid #d9d9d9;background:#fff;cursor:pointer;border-radius:4px;">取消</button>
          <button onclick="submitWithdraw()" style="padding:8px 16px;background:#ff4d4f;color:#fff;border:none;cursor:pointer;border-radius:4px;">提交</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
  };

  // ========== 提交提现申请 ==========
  window.submitWithdraw = function() {
    const coinSymbol = document.getElementById('withdraw-coin').value;
    const amount = document.getElementById('withdraw-amount').value;
    const address = document.getElementById('withdraw-address').value;
    const fee = document.getElementById('withdraw-fee').value;
    const remark = document.getElementById('withdraw-remark').value;

    if (!amount || parseFloat(amount) <= 0) {
      alert('请输入有效的提现金额');
      return;
    }
    if (!address) {
      alert('请输入提现地址');
      return;
    }

    const token = localStorage.getItem('token') || '';

    fetch('/api/withdraw/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        coin_symbol: coinSymbol,
        amount: parseFloat(amount),
        address: address,
        fee: parseFloat(fee) || 0,
        remark: remark,
      }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        alert('提现申请提交成功！');
        document.getElementById('klakna-withdraw-dialog').remove();
      } else {
        alert('提交失败：' + (data.msg || '未知错误'));
      }
    })
    .catch(err => {
      console.error('[KLAKNA] 提现申请失败:', err);
      alert('提交失败，请稍后重试');
    });
  };

  // ========== 显示记录弹窗 ==========
  window.showRecordsDialog = function() {
    const dialog = document.createElement('div');
    dialog.id = 'klakna-records-dialog';
    dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2147483647;';
    dialog.innerHTML = `
      <div style="background:#fff;padding:24px;border-radius:8px;width:600px;max-width:90%;max-height:80vh;overflow-y:auto;">
        <h3 style="margin:0 0 16px 0;">充值/提现记录</h3>
        <div id="records-content">加载中...</div>
        <div style="text-align:right;margin-top:16px;">
          <button onclick="document.getElementById('klakna-records-dialog').remove()" style="padding:8px 16px;background:#1890ff;color:#fff;border:none;cursor:pointer;border-radius:4px;">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    loadRecords();
  };

  // ========== 加载记录 ==========
  async function loadRecords() {
    const token = localStorage.getItem('token') || '';
    let html = '';

    try {
      // 加载充值记录
      const rechargeRes = await fetch('/api/recharge/list?page=1&size=10', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const rechargeData = await rechargeRes.json();

      html += '<h4>充值记录</h4>';
      if (rechargeData.code === 200 && rechargeData.data && rechargeData.data.content) {
        html += '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">';
        html += '<tr><th style="border:1px solid #d9d9d9;padding:8px;text-align:left;">ID</th><th style="border:1px solid #d9d9d9;padding:8px;text-align:left;">币种</th><th style="border:1px solid #d9d9d9;padding:8px;text-align:left;">金额</th><th style="border:1px solid #d9d9d9;padding:8px;text-align:left;">状态</th></tr>';
        rechargeData.data.content.records.forEach(r => {
          html += `<tr>
            <td style="border:1px solid #d9d9d9;padding:8px;">${r.id}</td>
            <td style="border:1px solid #d9d9d9;padding:8px;">${r.coin_symbol}</td>
            <td style="border:1px solid #d9d9d9;padding:8px;">${r.amount}</td>
            <td style="border:1px solid #d9d9d9;padding:8px;">${r.status}</td>
          </tr>`;
        });
        html += '</table>';
      } else {
        html += '<p>暂无充值记录</p>';
      }

      // 加载提现记录
      const withdrawRes = await fetch('/api/withdraw/list?page=1&size=10', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const withdrawData = await withdrawRes.json();

      html += '<h4>提现记录</h4>';
      if (withdrawData.code === 200 && withdrawData.data && withdrawData.data.content) {
        html += '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">';
        html += '<tr><th style="border:1px solid #d9d9d9;padding:8px;text-align:left;">ID</th><th style="border:1px solid #d9d9d9;padding:8px;text-align:left;">币种</th><th style="border:1px solid #d9d9d9;padding:8px;text-align:left;">金额</th><th style="border:1px solid #d9d9d9;padding:8px;text-align:left;">状态</th></tr>';
        withdrawData.data.content.records.forEach(r => {
          html += `<tr>
            <td style="border:1px solid #d9d9d9;padding:8px;">${r.id}</td>
            <td style="border:1px solid #d9d9d9;padding:8px;">${r.coin_symbol}</td>
            <td style="border:1px solid #d9d9d9;padding:8px;">${r.amount}</td>
            <td style="border:1px solid #d9d9d9;padding:8px;">${r.status}</td>
          </tr>`;
        });
        html += '</table>';
      } else {
        html += '<p>暂无提现记录</p>';
      }

      document.getElementById('records-content').innerHTML = html;
    } catch (err) {
      console.error('[KLAKNA] 加载记录失败:', err);
      document.getElementById('records-content').innerHTML = '<p>加载失败，请稍后重试</p>';
    }
  }

  // ========== 启动 ==========
  init();

  console.log('[KLAKNA Recharge/Withdraw] 模块加载完成');

})();

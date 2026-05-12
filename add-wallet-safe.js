const fs = require('fs');
const path = 'C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/public/admin-app.js';

let content = fs.readFileSync(path, 'utf8');

// 1. 在 NAV_ITEMS 的 finance 区块添加菜单项
const menuAnchor = `      {key:'finance-coin', icon:'[C]', text:'COIN LIST'},
    ]`;
const menuInsert = `      {key:'finance-coin', icon:'[C]', text:'COIN LIST'},
      {key:'wallet-config', icon:'[W]', text:'WALLET CONFIG'},
      {key:'collection', icon:'[C]', text:'COLLECTION'},
    ]`;
if (!content.includes(menuInsert.split('\n')[0])) {
  content = content.replace(menuAnchor, menuInsert);
  console.log('[1/3] Menu items added to NAV_ITEMS');
} else {
  console.log('[1/3] Menu items already exist, skipping');
}

// 2. 在 renderers 对象中添加渲染函数引用
const renderersAnchor = `  'finance-flow':pgFinanceFlow, 'finance-assets':pgFinanceAssets, 'finance-coin':pgFinanceCoin,
  // ========== 客服管理 ==========`;
const renderersInsert = `  'finance-flow':pgFinanceFlow, 'finance-assets':pgFinanceAssets, 'finance-coin':pgFinanceCoin,
  'wallet-config':pgWalletConfig, 'collection':pgCollection,
  // ========== 客服管理 ==========`;
if (!content.includes("'wallet-config':pgWalletConfig")) {
  content = content.replace(renderersAnchor, renderersInsert);
  console.log('[2/3] Renderers added');
} else {
  console.log('[2/3] Renderers already exist, skipping');
}

// 3. 在文件末尾追加函数实现
const functionsCode = `

// ================================================================
//  WALLET CONFIG (钱包配置管理)
// ================================================================
async function pgWalletConfig() {
  _curPage='wallet-config';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/wallet-config/list',{});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const configs=r.data?.list||[];
    const rows=configs.map(c=>{
      const statusBadge=c.is_active?'<span style="color:var(--success)">● 启用</span>':'<span style="color:var(--danger)">● 禁用</span>';
      return '<tr>'+
        '<td>'+c.id+'</td>'+
        '<td>'+H(c.coin_type||'')+'</td>'+
        '<td>'+H(c.wallet_name||'')+'</td>'+
        '<td><span style="font-size:11px;word-break:break-all">'+H(c.wallet_address||'')+'</span></td>'+
        '<td>'+H(c.wallet_type||'')+'</td>'+
        '<td>'+statusBadge+'</td>'+
        '<td>'+T(c.created_at)+'</td>'+
        '<td>'+
          '<button class="btn btn-sm btn-accent" onclick="editWalletConfig('+c.id+')">编辑</button> '+
          '<button class="btn btn-sm btn-danger" onclick="deleteWalletConfig('+c.id+')">删除</button> '+
          '<button class="btn btn-sm '+(c.is_active?'btn-warning':'btn-success')+'" onclick="toggleWalletConfig('+c.id+','+(c.is_active?0:1)+')">'+(c.is_active?'禁用':'启用')+'</button>'+
        '</td>'+
      '</tr>';
    }).join('');
    el.innerHTML=
      '<div class="card">'+
        '<div class="card-header">'+
          '<h3>钱包配置管理 (WALLET CONFIG)</h3>'+
          '<div><button class="btn btn-success" onclick="createWalletConfig()">+ 添加钱包</button></div>'+
        '</div>'+
        '<div class="card-body" style="overflow-x:auto">'+
          '<table>'+
            '<thead><tr><th>ID</th><th>币种</th><th>钱包名称</th><th>钱包地址</th><th>类型</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>'+
            '<tbody>'+(rows||'<tr><td colspan="8" style="text-align:center;color:var(--text2)">无钱包配置</td></tr>')+'</tbody>'+
          '</table>'+
        '</div>'+
      '</div>';
    _go['wallet-config']=pgWalletConfig;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function createWalletConfig() {
  const body='<div style="line-height:2">'+
    '<b>Coin Type:</b> <select id="wcCoinType" style="width:200px;padding:6px">'+
      '<option value="BTC">BTC</option>'+
      '<option value="ETH">ETH</option>'+
      '<option value="USDT-OMNI">USDT-OMNI</option>'+
      '<option value="USDT-ERC20">USDT-ERC20</option>'+
      '<option value="USDT-TRC20" selected>USDT-TRC20</option>'+
    '</select><br>'+
    '<b>Wallet Name:</b> <input type="text" id="wcWalletName" placeholder="e.g. 中心热钱包" style="width:200px"><br>'+
    '<b>Wallet Address:</b> <input type="text" id="wcWalletAddress" placeholder="e.g. TRx123..." style="width:300px"><br>'+
    '<b>Wallet Type:</b> <select id="wcWalletType" style="width:200px;padding:6px">'+
      '<option value="central" selected>central (中心钱包)</option>'+
      '<option value="collection">collection (归集钱包)</option>'+
    '</select><br>'+
    '<b>Remark:</b> <input type="text" id="wcRemark" placeholder="备注" style="width:200px"><br>'+
  '</div>';
  const footer='<button class="btn btn-accent" onclick="saveWalletConfig()">Create</button>'+
               '<button class="btn" onclick="closeModal()">Cancel</button>';
  showModal('Create Wallet Config', body, footer);
}

async function saveWalletConfig() {
  const coin_type=document.getElementById('wcCoinType').value;
  const wallet_name=document.getElementById('wcWalletName').value.trim();
  const wallet_address=document.getElementById('wcWalletAddress').value.trim();
  const wallet_type=document.getElementById('wcWalletType').value;
  const remark=document.getElementById('wcRemark').value.trim();
  if(!coin_type||!wallet_name||!wallet_address||!wallet_type){alert('Required fields missing');return;}
  const r=await api('/admin/wallet-config/create',{coin_type,wallet_name,wallet_address,wallet_type,remark});
  if(r.code===200){alert('[OK] Wallet config created');closeModal();pgWalletConfig();}
  else alert('[ERROR] '+r.msg);
}

async function editWalletConfig(id) {
  const r=await api('/admin/wallet-config/list',{});
  if(r.code!==200){alert('[ERROR] '+r.msg);return;}
  const config=r.data.list.find(c=>c.id===id);
  if(!config){alert('Config not found');return;}
  const body='<div style="line-height:2">'+
    '<b>Coin Type:</b> <select id="editWCCoinType" style="width:200px;padding:6px">'+
      '<option value="BTC"'+(config.coin_type==='BTC'?' selected':'')+'>BTC</option>'+
      '<option value="ETH"'+(config.coin_type==='ETH'?' selected':'')+'>ETH</option>'+
      '<option value="USDT-OMNI"'+(config.coin_type==='USDT-OMNI'?' selected':'')+'>USDT-OMNI</option>'+
      '<option value="USDT-ERC20"'+(config.coin_type==='USDT-ERC20'?' selected':'')+'>USDT-ERC20</option>'+
      '<option value="USDT-TRC20"'+(config.coin_type==='USDT-TRC20'?' selected':'')+'>USDT-TRC20</option>'+
    '</select><br>'+
    '<b>Wallet Name:</b> <input type="text" id="editWCWalletName" value="'+H(config.wallet_name||'')+'" style="width:200px"><br>'+
    '<b>Wallet Address:</b> <input type="text" id="editWCWalletAddress" value="'+H(config.wallet_address||'')+'" style="width:300px"><br>'+
    '<b>Wallet Type:</b> <select id="editWCWalletType" style="width:200px;padding:6px">'+
      '<option value="central"'+(config.wallet_type==='central'?' selected':'')+'>central (中心钱包)</option>'+
      '<option value="collection"'+(config.wallet_type==='collection'?' selected':'')+'>collection (归集钱包)</option>'+
    '</select><br>'+
    '<b>Remark:</b> <input type="text" id="editWCRemark" value="'+H(config.remark||'')+'" style="width:200px"><br>'+
  '</div>';
  const footer='<button class="btn btn-accent" onclick="updateWalletConfig('+id+')">Update</button>'+
               '<button class="btn" onclick="closeModal()">Cancel</button>';
  showModal('Edit Wallet Config', body, footer);
}

async function updateWalletConfig(id) {
  const coin_type=document.getElementById('editWCCoinType').value;
  const wallet_name=document.getElementById('editWCWalletName').value.trim();
  const wallet_address=document.getElementById('editWCWalletAddress').value.trim();
  const wallet_type=document.getElementById('editWCWalletType').value;
  const remark=document.getElementById('editWCRemark').value.trim();
  const r=await api('/admin/wallet-config/update',{id,coin_type,wallet_name,wallet_address,wallet_type,remark});
  if(r.code===200){alert('[OK] Wallet config updated');closeModal();pgWalletConfig();}
  else alert('[ERROR] '+r.msg);
}

async function deleteWalletConfig(id) {
  if(!confirm('确认删除此钱包配置？'))return;
  const r=await api('/admin/wallet-config/delete',{id});
  if(r.code===200){alert('[OK] Wallet config deleted');pgWalletConfig();}
  else alert('[ERROR] '+r.msg);
}

async function toggleWalletConfig(id, is_active) {
  const r=await api('/admin/wallet-config/toggle',{id,is_active});
  if(r.code===200){pgWalletConfig();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  COLLECTION RECORDS (归集记录管理)
// ================================================================
async function pgCollection() {
  _curPage='collection';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/collection/list',{page:1,size:50});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const records=r.data?.list||[];
    const total=r.data?.total||0;
    const rows=records.map(rec=>{
      const statusColor=rec.status==='completed'?'var(--success)':rec.status==='failed'?'var(--danger)':'var(--warning)';
      return '<tr>'+
        '<td>'+rec.id+'</td>'+
        '<td>'+rec.user_id+'</td>'+
        '<td>'+H(rec.username||'')+'</td>'+
        '<td>'+H(rec.coin_type||'')+'</td>'+
        '<td><span style="font-size:11px;word-break:break-all">'+H(rec.from_address||'')+'</span></td>'+
        '<td><span style="font-size:11px;word-break:break-all">'+H(rec.to_address||'')+'</span></td>'+
        '<td>'+N(rec.amount,4)+'</td>'+
        '<td>'+N(rec.gas_fee,4)+'</td>'+
        '<td style="color:'+statusColor+'">'+H(rec.status||'')+'</td>'+
        '<td><span style="font-size:11px;word-break:break-all">'+H(rec.tx_hash||'-')+'</span></td>'+
        '<td>'+T(rec.created_at)+'</td>'+
        '<td>'+
          '<button class="btn btn-sm btn-accent" onclick="viewCollection('+rec.id+')">详情</button> '+
          '<button class="btn btn-sm btn-danger" onclick="deleteCollection('+rec.id+')">删除</button>'+
        '</td>'+
      '</tr>';
    }).join('');
    el.innerHTML=
      '<div class="card">'+
        '<div class="card-header">'+
          '<h3>归集记录管理 (COLLECTION RECORDS) - Total: '+total+'</h3>'+
          '<div><button class="btn btn-success" onclick="createCollection()">+ 创建归集记录</button></div>'+
        '</div>'+
        '<div class="card-body" style="overflow-x:auto">'+
          '<table>'+
            '<thead><tr><th>ID</th><th>用户ID</th><th>用户名</th><th>币种</th><th>From</th><th>To</th><th>金额</th><th>Gas费</th><th>状态</th><th>TxHash</th><th>创建时间</th><th>操作</th></tr></thead>'+
            '<tbody>'+(rows||'<tr><td colspan="12" style="text-align:center;color:var(--text2)">无归集记录</td></tr>')+'</tbody>'+
          '</table>'+
        '</div>'+
      '</div>';
    _go['collection']=pgCollection;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function createCollection() {
  const body='<div style="line-height:2">'+
    '<b>User ID:</b> <input type="number" id="colUserId" placeholder="User ID" style="width:200px"><br>'+
    '<b>Coin Type:</b> <select id="colCoinType" style="width:200px;padding:6px">'+
      '<option value="BTC">BTC</option>'+
      '<option value="ETH">ETH</option>'+
      '<option value="USDT-OMNI">USDT-OMNI</option>'+
      '<option value="USDT-ERC20">USDT-ERC20</option>'+
      '<option value="USDT-TRC20" selected>USDT-TRC20</option>'+
    '</select><br>'+
    '<b>From Address:</b> <input type="text" id="colFrom" placeholder="用户钱包地址" style="width:300px"><br>'+
    '<b>To Address:</b> <input type="text" id="colTo" placeholder="中心钱包地址" style="width:300px"><br>'+
    '<b>Amount:</b> <input type="number" id="colAmount" placeholder="归集金额" step="0.0001" style="width:200px"><br>'+
    '<b>TxHash:</b> <input type="text" id="colTxHash" placeholder="可选，交易哈希" style="width:300px"><br>'+
  '</div>';
  const footer='<button class="btn btn-accent" onclick="saveCollection()">Create</button>'+
               '<button class="btn" onclick="closeModal()">Cancel</button>';
  showModal('Create Collection Record', body, footer);
}

async function saveCollection() {
  const user_id=parseInt(document.getElementById('colUserId').value);
  const coin_type=document.getElementById('colCoinType').value;
  const from_address=document.getElementById('colFrom').value.trim();
  const to_address=document.getElementById('colTo').value.trim();
  const amount=parseFloat(document.getElementById('colAmount').value);
  const tx_hash=document.getElementById('colTxHash').value.trim();
  if(!user_id||!coin_type||!from_address||!to_address||!amount){alert('Required fields missing');return;}
  const r=await api('/admin/collection/create',{user_id,coin_type,from_address,to_address,amount,tx_hash});
  if(r.code===200){alert('[OK] Collection record created');closeModal();pgCollection();}
  else alert('[ERROR] '+r.msg);
}

async function viewCollection(id) {
  const r=await api('/admin/collection/detail',{id});
  if(r.code!==200){alert('[ERROR] '+r.msg);return;}
  const rec=r.data;
  if(!rec){alert('Record not found');return;}
  const body='<div style="line-height:2">'+
    '<b>ID:</b> '+rec.id+'<br>'+
    '<b>User ID:</b> '+rec.user_id+'<br>'+
    '<b>Username:</b> '+H(rec.username||'')+'<br>'+
    '<b>Coin Type:</b> '+H(rec.coin_type||'')+'<br>'+
    '<b>From:</b> <span style="word-break:break-all">'+H(rec.from_address||'')+'</span><br>'+
    '<b>To:</b> <span style="word-break:break-all">'+H(rec.to_address||'')+'</span><br>'+
    '<b>Amount:</b> '+N(rec.amount,4)+'<br>'+
    '<b>Gas Fee:</b> '+N(rec.gas_fee,4)+'<br>'+
    '<b>Status:</b> '+H(rec.status||'')+'<br>'+
    '<b>TxHash:</b> <span style="word-break:break-all;font-size:11px">'+H(rec.tx_hash||'-')+'</span><br>'+
    '<b>Error:</b> '+H(rec.error_msg||'-')+'<br>'+
    '<b>Created:</b> '+T(rec.created_at)+'<br>'+
    '<b>Completed:</b> '+T(rec.completed_at)+'<br>'+
  '</div>'+
  '<hr>'+
  '<div style="margin-top:12px">'+
    '<b>Update Status:</b><br>'+
    '<select id="updateColStatus" style="padding:6px;margin:6px 0">'+
      '<option value="pending">pending</option>'+
      '<option value="completed">completed</option>'+
      '<option value="failed">failed</option>'+
    '</select><br>'+
    '<b>TxHash:</b> <input type="text" id="updateColTxHash" placeholder="Transaction hash" style="width:300px"><br>'+
    '<b>Error Msg:</b> <input type="text" id="updateColError" placeholder="Error message (if failed)" style="width:300px"><br>'+
    '<button class="btn btn-accent" onclick="updateCollectionStatus('+id+')">Update Status</button>'+
  '</div>';
  showModal('Collection Detail', body, '<button class="btn" onclick="closeModal()">Close</button>');
}

async function updateCollectionStatus(id) {
  const status=document.getElementById('updateColStatus').value;
  const tx_hash=document.getElementById('updateColTxHash').value.trim();
  const error_msg=document.getElementById('updateColError').value.trim();
  const r=await api('/admin/collection/update-status',{id,status,tx_hash,error_msg});
  if(r.code===200){alert('[OK] Status updated');closeModal();pgCollection();}
  else alert('[ERROR] '+r.msg);
}

async function deleteCollection(id) {
  if(!confirm('确认删除此归集记录？'))return;
  const r=await api('/admin/collection/delete',{id});
  if(r.code===200){alert('[OK] Collection record deleted');pgCollection();}
  else alert('[ERROR] '+r.msg);
}
`;

// 只追加一次
if (!content.includes('async function pgWalletConfig()')) {
  content += functionsCode;
  console.log('[3/3] Wallet/Collection functions appended to end of file');
} else {
  console.log('[3/3] Functions already exist, skipping');
}

fs.writeFileSync(path, content, 'utf8');
console.log('\nDone! All wallet management features added safely.');

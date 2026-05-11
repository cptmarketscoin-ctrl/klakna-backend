// ===== KLAKNA ADMIN PANEL APP v5 (Finance Submenu) =====

// 添加子菜单样式
(function addSubmenuStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .nav-parent {
      font-weight: bold;
      background: rgba(255,255,255,0.05);
      border-left: 3px solid var(--accent, #00d4ff);
    }
    .nav-parent-open {
      background: rgba(255,255,255,0.08);
    }
    .nav-arrow {
      margin-left: auto;
      font-size: 10px;
      transition: transform 0.3s;
    }
    .nav-parent-open .nav-arrow {
      transform: rotate(180deg);
    }
    .nav-children .nav-item {
      font-weight: normal;
      border-left: 3px solid transparent;
      font-size: 13px;
    }
    .nav-children .nav-item:hover {
      background: rgba(255,255,255,0.08);
      border-left-color: var(--accent, #00d4ff);
    }
  `;
  document.head.appendChild(style);
})();

const NAV_ITEMS = [
  {key:'dashboard', icon:'[D]', text:'DASHBOARD'},

  // ========== 用户管理 ==========
  {
    key:'user-mgmt',
    icon:'[U]',
    text:'USER MANAGEMENT',
    children: [
      {key:'users', icon:'[U]', text:'USERS'},
      {key:'user-manage', icon:'[U]', text:'USER MANAGE'},
      {key:'verification', icon:'[V]', text:'VERIFICATION'},
      {key:'login-log', icon:'[L]', text:'LOGIN LOG'},
      {key:'checkin', icon:'[C]', text:'CHECKIN'},
    ]
  },

  // ========== 财务管理 ==========
  {
    key:'finance',
    icon:'[F]',
    text:'FINANCE MANAGEMENT',
    children: [
      {key:'finance-recharge', icon:'[R]', text:'RECHARGE'},
      {key:'finance-withdraw', icon:'[W]', text:'WITHDRAW'},
      {key:'finance-transfer', icon:'[T]', text:'TRANSFER'},
      {key:'finance-flow', icon:'[F]', text:'ASSET FLOW'},
      {key:'finance-assets', icon:'[A]', text:'USER ASSETS'},
      {key:'finance-coin', icon:'[C]', text:'COIN LIST'},
    ]
  },

  // ========== 角色与权限 ==========
  {
    key:'role-access',
    icon:'[R]',
    text:'ROLE & ACCESS',
    children: [
      {key:'roles', icon:'[R]', text:'ROLES'},
      {key:'permissions', icon:'[P]', text:'PERMISSIONS'},
      {key:'menus', icon:'[M]', text:'MENUS'},
    ]
  },

  // ========== 交易管理 ==========
  {
    key:'trading',
    icon:'[T]',
    text:'TRADING MANAGEMENT',
    children: [
      {key:'orders', icon:'[O]', text:'ORDERS'},
      {key:'positions', icon:'[P]', text:'POSITIONS'},
      {key:'flows', icon:'[F]', text:'FLOWS'},
      {key:'coins', icon:'[C]', text:'COINS'},
      {key:'market', icon:'[M]', text:'MARKET'},
    ]
  },

  // ========== 系统控制 ==========
  {
    key:'sys-control',
    icon:'[S]',
    text:'SYSTEM CONTROL',
    children: [
      {key:'inject', icon:'[I]', text:'INJECT'},
      {key:'restrict', icon:'[R]', text:'RESTRICT'},
      {key:'command', icon:'[C]', text:'COMMAND'},
      {key:'controls', icon:'[T]', text:'CONTROLS'},
    ]
  },

  // ========== 风控管理 ==========
  {
    key:'risk-control',
    icon:'[K]',
    text:'RISK CONTROL',
    children: [
      {key:'market-control', icon:'[M]', text:'MARKET CONTROL'},
  // ========== 客服管理 ==========
  {
    key:'cs-mgmt',
    icon:'[C]',
    text:'CUSTOMER SERVICE',
    children: [
      {key:'cs-config', icon:'[S]', text:'CS CONFIG'},
      {key:'cs-messages', icon:'[M]', text:'CS MESSAGES'},
    ]
  },
      {key:'contract-risk', icon:'[C]', text:'CONTRACT RISK'},
    ]
  },

  // ========== MoonPay ==========
  {
    key:'moonpay',
    icon:'[M]',
    text:'MOONPAY',
    children: [
      {key:'moonpay-config', icon:'[M]', text:'MOONPAY CONFIG'},
      {key:'moonpay-orders', icon:'[O]', text:'MOONPAY ORDERS'},
    ]
  },

  // ========== 系统工具 ==========
  {
    key:'system',
    icon:'[S]',
    text:'SYSTEM',
    children: [
      {key:'op-logs', icon:'[L]', text:'OP LOGS'},
      {key:'sql', icon:'[S]', text:'SQL'},
      {key:'config', icon:'[K]', text:'CONFIG'},
      {key:'danger', icon:'[!]', text:'DANGER ZONE'},
    ]
  },
];

// ===== 渲染菜单函数（全局）=====
function renderMenu(items, level = 0) {
  return items.map((n, i) => {
    // 如果有 children，渲染为可展开的父级菜单
    if (n.children) {
      return `<div class="nav-item nav-parent" data-key="${n.key}" onclick="toggleSubMenu('${n.key}', this)">
        <span class="nav-icon">${n.icon}</span>
        <span class="nav-text">${n.text}</span>
        <span class="nav-arrow">▼</span>
      </div>
      <div class="nav-children" id="submenu-${n.key}" style="display:none">
        ${renderMenu(n.children, level + 1)}
      </div>`;
    }
    // 普通菜单项 - 添加 event.stopPropagation() 防止事件冒泡
    const paddingLeft = 20 + level * 20;
    return `<div class="nav-item" data-page="${n.key}" onclick="event.stopPropagation(); navigateTo('${n.key}',this)" style="padding-left:${paddingLeft}px">
      <span class="nav-icon">${n.icon}</span><span class="nav-text">${n.text}</span>
    </div>`;
  }).join('');
}

// ===== 展开/折叠子菜单（全局）=====
function toggleSubMenu(key, el) {
  const submenu = document.getElementById('submenu-' + key);
  if (submenu) {
    const isVisible = submenu.style.display !== 'none';
    submenu.style.display = isVisible ? 'none' : 'block';
    el.classList.toggle('nav-parent-open', !isVisible);
  }
}

// ===== 导航到页面（全局）=====
function navigateTo(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  
  // 递归查找菜单项（支持子菜单）
  function findMenuItem(items, key) {
    for (const item of items) {
      if (item.key === key) return item;
      if (item.children) {
        const found = findMenuItem(item.children, key);
        if (found) return found;
      }
    }
    return null;
  }
  
  const m = findMenuItem(NAV_ITEMS, page) || NAV_ITEMS[0];
  document.getElementById('pageIcon').textContent = m.icon;
  document.getElementById('pageTitle').textContent = m.text;
  const area = document.getElementById('contentArea');
  area.scrollTop = 0;
  renderers[page] ? renderers[page]() : (area.innerHTML = '<div class="empty">[ NOT FOUND: ' + page + ' ]</div>');
}

// ===== 主初始化函数 =====
function showAdmin() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminView').style.display = 'flex';
  const nav = document.getElementById('sidebarNav');
  
  // 使用全局的 renderMenu 函数渲染菜单
  nav.innerHTML = renderMenu(NAV_ITEMS);
  navigateTo('dashboard', nav.querySelector('.nav-item'));
}

// ===== API =====
const API_BASE = (() => {
  // ：localhost-?080，8080
  const h = window.location.hostname;
  const p = window.location.port;
  if ((h === 'localhost' || h === '127.0.0.1') && p !== '8080') {
    return 'http://' + h + ':8080';
  }
  return '';
})();

async function api(path, body) {
  const url = API_BASE + path;
  const opts = { method:'POST', headers:{ 'Authorization':'Bearer '+token, 'Content-Type':'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, opts);
    if (!r.ok) {
      const text = await r.text();
      console.error('[API Error] status=' + r.status + ' url=' + url + ' response=' + text.substring(0, 200));
      throw new Error('HTTP ' + r.status);
    }
    return r.json();
  } catch(e) {
    console.error('[API Fetch Error]', e.message, 'url=' + url);
    throw e;
  }
}

// ===== UTILS =====
function H(s) { return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function A(s) { return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function N(v,d=4) { return parseFloat(v||0).toFixed(d); }
function T(s) { return s ? String(s).slice(0,16).replace('T',' ') : '-'; }
function P(v) { return parseInt(v)||1; }
function DC(r) { return r.data?.content || r.data || {}; }

// ===== PAGINATION =====
function pag(cur, pages) {
  if (!pages || pages <= 1) return '';
  let b = '';
  for (let i=1;i<=pages;i++) {
    if (pages>10 && i>3 && i<pages-1 && Math.abs(i-cur)>1) { if(i===4||i===pages-2) b+='<span style="color:var(--text2);padding:0 4px">...</span>'; continue; }
    b+=`<button class="page-btn${i===cur?' active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  return `<div class="pagination"><button class="page-btn" ${cur<=1?'disabled':''} onclick="goPage(${cur-1})">&#9664;</button>${b}<button class="page-btn" ${cur>=pages?'disabled':''} onclick="goPage(${cur+1})">&#9654;</button></div>`;
}

// ===== MODAL =====
function showModal(title, body, footer) {
  closeModal();
  const d=document.createElement('div'); d.className='modal-overlay'; d.id='modalOverlay';
  d.innerHTML=`<div class="modal"><div class="modal-header"><h3>${H(title)}</h3><span class="modal-close" onclick="closeModal()">&times;</span></div><div class="modal-body">${body}</div>${footer?'<div class="modal-footer">'+footer+'</div>':''}</div>`;
  document.body.appendChild(d);
  d.addEventListener('click',e=>{if(e.target===d)closeModal()});
}
function closeModal() { const m=document.getElementById('modalOverlay'); if(m)m.remove(); }

// ===== PAGE ROUTING =====
const renderers = { dashboard:pgDashboard, users:pgUsers, roles:pgRoles, permissions:pgPermissions, menus:pgMenus,
  orders:pgOrders, positions:pgPositions, flows:pgFlows, coins:pgCoins, market:pgMarket,
  inject:pgInject, restrict:pgRestrict, command:pgCommand, controls:pgControls,
  'market-control':pgMarketControl, 'contract-risk':pgContractRisk,
  'moonpay-config':pgMoonpayConfig, 'moonpay-orders':pgMoonpayOrders,
  'op-logs':pgLogs, sql:pgSql, config:pgConfig, danger:pgDanger,
  // ========== 新增：用户管理 ==========
  'user-manage':pgUserManage, 'verification':pgVerification, 'login-log':pgLoginLog, 'checkin':pgCheckin,
  // ========== 财务管理 ==========
  'finance-recharge':pgFinanceRecharge, 'finance-withdraw':pgFinanceWithdraw, 'finance-transfer':pgFinanceTransfer,
  'finance-flow':pgFinanceFlow, 'finance-assets':pgFinanceAssets, 'finance-coin':pgFinanceCoin,
  // ========== 客服管理 ==========
  'cs-config':pgCsConfig, 'cs-messages':pgCsMessages,
};
let _curPage='dashboard';
function goPage(p) { _go[_curPage]?.(p); }
const _go = {};

// ================================================================
//  DASHBOARD
// ================================================================
async function pgDashboard() {
  _curPage='dashboard';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/dashboard');
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    let recentRows='';
    if(d.recentUsers?.length){
      recentRows=d.recentUsers.map(u=>`<tr><td>${u.id}</td><td>${H(u.username||u.wallet_address)}</td><td>${H(u.nick_name||'')}</td><td>${T(u.created_at)}</td></tr>`).join('');
    } else { recentRows='<tr><td colspan="4" style="text-align:center;color:var(--text2)">No users</td></tr>'; }
    const sys = d.system || {};
    const upMin = Math.floor((sys.uptime||0)/60);
    const memMB = sys.memory ? Math.round((sys.memory.rss||0)/1024/1024) : '?';
    el.innerHTML=`
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">TOTAL USERS</div><div class="stat-value accent">${d.userCount||0}</div></div>
        <div class="stat-card purple"><div class="stat-label">ADMINS</div><div class="stat-value purple">${d.adminCount||0}</div></div>
        <div class="stat-card warning"><div class="stat-label">TOTAL ORDERS</div><div class="stat-value" style="color:var(--warning)">${d.orderCount||0}</div></div>
        <div class="stat-card danger"><div class="stat-label">OPEN POSITIONS</div><div class="stat-value" style="color:var(--danger)">${d.openPositions||0}</div></div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">TOTAL FEE</div><div class="stat-value accent">${d.totalFee||'0'}</div></div>
        <div class="stat-card purple"><div class="stat-label">TOTAL PNL</div><div class="stat-value purple" style="color:${parseFloat(d.totalPnl)>=0?'var(--accent)':'var(--danger)'}">${d.totalPnl||'0'}</div></div>
        <div class="stat-card warning"><div class="stat-label">TOTAL ASSETS</div><div class="stat-value" style="color:var(--warning)">${d.totalAssets||'0'}</div></div>
      </div>
      <div class="card" style="border-color:${sys.maintenanceMode?'var(--danger)':'var(--border2)'}">
        <div class="card-header"><h3>SYSTEM STATUS</h3></div>
        <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;font-size:11px">
          <div><span style="color:var(--text2)">UPTIME:</span> <span style="color:var(--accent)">${upMin}m</span></div>
          <div><span style="color:var(--text2)">MEMORY:</span> <span>${memMB}MB</span></div>
          <div><span style="color:var(--text2)">PID:</span> <span>${sys.pid||'?'}</span></div>
          <div><span style="color:var(--text2)">MAINT:</span> <span style="color:${sys.maintenanceMode?'var(--danger)':'var(--accent)'}">${sys.maintenanceMode?'ON':'OFF'}</span></div>
        </div>
      </div>
      <div class="card"><div class="card-header"><h3>RECENT USERS</h3></div><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>USERNAME</th><th>NICKNAME</th><th>CREATED</th></tr></thead><tbody>${recentRows}</tbody></table>
      </div></div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ NETWORK ERROR ]</div>'; }
}

// ================================================================
//  USERS
// ================================================================
let _uPage=1,_uKw='';
async function pgUsers(page) {
  _curPage='users'; if(page) _uPage=page; _go.users=p=>pgUsers(p);
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING USERS... ]</div>';
  try {
    const r=await api('/admin/user/list',{page:_uPage,size:15,keyword:_uKw||undefined});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const c=DC(r), rows=c.records||[];
    const trs=rows.map(u=>`<tr>
      <td>${u.id}</td><td>${H(u.username)}</td><td>${H(u.email)}</td><td>${H(u.phone)}</td>
      <td><span class="badge ${u.status==1?'badge-green':'badge-red'}">${u.status==1?'ACTIVE':'DISABLED'}</span></td>
      <td>${N(u.usdtBalance,2)}</td><td>${T(u.created_at)}</td>
      <td style="white-space:normal">
        <button class="btn btn-sm btn-accent" onclick="showUserDetail(${u.id})">DETAIL</button>
        <button class="btn btn-sm btn-warning" onclick="showSetBal(${u.id},'${A(u.username)}',${u.usdtBalance||0})">BAL</button>
        <button class="btn btn-sm ${u.status==1?'btn-danger':'btn-accent'}" onclick="toggleUser(${u.id},${u.status==1?0:1})">${u.status==1?'OFF':'ON'}</button>
        <button class="btn btn-sm btn-danger" onclick="delUser(${u.id},'${A(u.username)}')">DEL</button>
      </td></tr>`).join('');
    el.innerHTML=`
      <div class="toolbar">
        <input class="search-input" id="uSrch" placeholder="Search username/email/phone..." value="${H(_uKw)}"
          onkeydown="if(event.key==='Enter'){_uKw=this.value;pgUsers(1)}">
        <button class="btn btn-accent" onclick="_uKw=document.getElementById('uSrch').value;pgUsers(1)">SEARCH</button>
      </div>
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>USERNAME</th><th>EMAIL</th><th>PHONE</th><th>STATUS</th><th>USDT</th><th>CREATED</th><th>ACTIONS</th></tr></thead>
        <tbody>${trs||'<tr><td colspan="8" style="text-align:center;color:var(--text2)">No data</td></tr>'}</tbody></table>
      </div>${pag(c.current,c.pages)}</div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}

async function showUserDetail(id) {
  const r=await api('/admin/user/detail',{userId:id});
  if(r.code!==200)return alert('[ERROR] '+r.msg);
  const u=r.data;
  let walletsH='';
  if(u.wallets?.length) walletsH=u.wallets.map(w=>`<tr><td>${H(w.coin_symbol)}</td><td>${N(w.available,2)}</td><td>${N(w.frozen,2)}</td></tr>`).join('');
  let posH='';
  if(u.openPositions?.length) posH=u.openPositions.map(p=>`<tr><td>${H(p.symbol)}</td><td>${p.side||''}</td><td>${N(p.margin,2)}</td><td>${N(p.leverage)}x</td></tr>`).join('');
  showModal('USER #'+u.id,`
    <div style="font-size:12px;line-height:2.2">
      <div><span style="color:var(--text2)">ID:</span> ${u.id}</div>
      <div><span style="color:var(--text2)">Username:</span> ${H(u.username)}</div>
      <div><span style="color:var(--text2)">Nickname:</span> ${H(u.nick_name||u.nickName||'')}</div>
      <div><span style="color:var(--text2)">Email:</span> ${H(u.email||'N/A')}</div>
      <div><span style="color:var(--text2)">Role:</span> ${H(u.role)}</div>
      <div><span style="color:var(--text2)">Status:</span> <span class="badge ${u.status==1?'badge-green':'badge-red'}">${u.status==1?'ACTIVE':'DISABLED'}</span></div>
      <div><span style="color:var(--text2)">Orders:</span> ${u.orderCount||0}</div>
    </div>
    ${walletsH?`<h4 style="font-size:11px;margin:12px 0 6px;color:var(--accent)">WALLETS</h4><table><thead><tr><th>COIN</th><th>AVAILABLE</th><th>FROZEN</th></tr></thead><tbody>${walletsH}</tbody></table>`:''}
    ${posH?`<h4 style="font-size:11px;margin:12px 0 6px;color:var(--accent)">POSITIONS</h4><table><thead><tr><th>SYMBOL</th><th>SIDE</th><th>MARGIN</th><th>LEV</th></tr></thead><tbody>${posH}</tbody></table>`:''}
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-warning" onclick="closeModal();showSetBal(${u.id},'${A(u.username)}',${u.usdtBalance||0})">BALANCE</button>
      <button class="btn btn-purple" onclick="closeModal();showResetPwd(${u.id},'${A(u.username)}')">RESET PWD</button>
      <button class="btn btn-danger" onclick="closeModal();delUser(${u.id},'${A(u.username)}')">DELETE</button>
    </div>`);
}

function showSetBal(id,username,bal) {
  showModal('BALANCE -?'+username,`
    <div style="margin-bottom:12px">Current: <span style="color:var(--accent);font-size:16px">${parseFloat(bal).toFixed(2)}</span></div>
    <div class="form-group"><label>COIN SYMBOL</label><input class="form-control" id="m_coin" value="USDT"></div>
    <div class="form-row">
      <div class="form-group"><label>SET TO</label><input class="form-control" id="m_set" type="number" step="0.01"></div>
      <div class="form-group"><label>ADD (+/-)</label><input class="form-control" id="m_add" type="number" step="0.01"></div>
    </div>
    <div id="m_balMsg"></div>`,
    `<button class="btn btn-accent" onclick="doSetBal(${id})">SET</button>
     <button class="btn btn-warning" onclick="doAddBal(${id})">ADD</button>
     <button class="btn" onclick="closeModal()">CANCEL</button>`);
}
async function doSetBal(id) {
  const coin=document.getElementById('m_coin').value||'USDT', amount=parseFloat(document.getElementById('m_set').value);
  if(!amount)return;
  const r=await api('/admin/user/setBalance',{userId:id,coinSymbol:coin,available:amount});
  document.getElementById('m_balMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">[OK]</span>':'<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
  if(r.code===200)setTimeout(()=>{closeModal();pgUsers()},600);
}
async function doAddBal(id) {
  const coin=document.getElementById('m_coin').value||'USDT', amount=parseFloat(document.getElementById('m_add').value);
  if(!amount)return;
  const r=await api('/admin/user/addBalance',{userId:id,coinSymbol:coin,amount});
  document.getElementById('m_balMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">[OK]</span>':'<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
  if(r.code===200)setTimeout(()=>{closeModal();pgUsers()},600);
}

function showResetPwd(id,username) {
  showModal('RESET PASSWORD -?'+username,`
    <div class="form-group"><label>NEW PASSWORD</label><input class="form-control" id="m_pwd" placeholder="Enter new password..."></div>
    <div id="m_pwdMsg"></div>`,
    `<button class="btn btn-danger" onclick="doResetPwd(${id})">RESET</button><button class="btn" onclick="closeModal()">CANCEL</button>`);
}
async function doResetPwd(id) {
  const pwd=document.getElementById('m_pwd').value; if(!pwd)return;
  const r=await api('/admin/user/resetPassword',{userId:id,newPassword:pwd});
  document.getElementById('m_pwdMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">[OK]</span>':'<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
}

async function toggleUser(id,status) {
  if(!confirm((status==1?'Enable':'Disable')+' user #'+id+'?'))return;
  const r=await api('/admin/user/setStatus',{userId:id,status});
  if(r.code===200)pgUsers();else alert('[ERROR] '+r.msg);
}
async function delUser(id,username) {
  if(!confirm('DELETE "'+username+'" (#'+id+')? CANNOT UNDO!'))return;
  const r=await api('/admin/user/delete',{userId:id});
  if(r.code===200)pgUsers();else alert('[ERROR] '+r.msg);
}

// ================================================================
//  ORDERS
// ================================================================
let _oPage=1,_oKw='';
async function pgOrders(page) {
  _curPage='orders'; if(page)_oPage=page; _go.orders=p=>pgOrders(p);
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/order/list',{page:_oPage,size:15});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const c=DC(r), rows=c.records||[];
    const trs=rows.map(o=>`<tr>
      <td>${o.id}</td><td>${o.user_id}</td><td>${H(o.username||o.nick_name)}</td><td>${H(o.symbol)}</td>
      <td><span class="badge ${o.side==='buy'?'badge-green':'badge-red'}">${(o.side||'').toUpperCase()}</span></td>
      <td>${N(o.price)}</td><td>${N(o.amount)}</td><td>${N(o.total)}</td><td>${N(o.fee)}</td>
      <td><span class="badge ${o.status==='filled'?'badge-green':'badge-yellow'}">${(o.status||'').toUpperCase()}</span></td>
      <td>${T(o.created_at)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="delOrder(${o.id})">DEL</button></td></tr>`).join('');
    el.innerHTML=`
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>USER</th><th>NAME</th><th>SYMBOL</th><th>SIDE</th><th>PRICE</th><th>AMT</th><th>TOTAL</th><th>FEE</th><th>STATUS</th><th>CREATED</th><th>ACTION</th></tr></thead>
        <tbody>${trs||'<tr><td colspan="12" style="text-align:center;color:var(--text2)">No data</td></tr>'}</tbody></table>
      </div>${pag(c.current,c.pages)}</div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}
async function delOrder(id) {
  if(!confirm('Delete order #'+id+'?'))return;
  const r=await api('/admin/order/delete',{orderId:id});
  if(r.code===200)pgOrders();else alert('[ERROR] '+r.msg);
}

// ================================================================
//  POSITIONS
// ================================================================
let _pPage=1;
async function pgPositions(page) {
  _curPage='positions'; if(page)_pPage=page; _go.positions=p=>pgPositions(p);
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/position/list',{page:_pPage,size:15});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const c=DC(r), rows=c.records||[];
    const trs=rows.map(p=>{
      const pnl=parseFloat(p.pnl||0);
      return `<tr>
        <td>${p.id}</td><td>${p.user_id}</td><td>${H(p.username)}</td><td>${H(p.symbol)}</td>
        <td><span class="badge ${p.side==='long'?'badge-green':'badge-red'}">${(p.side||'').toUpperCase()}</span></td>
        <td>${p.leverage||1}x</td><td>${N(p.margin,2)}</td><td>${N(p.open_price)}</td>
        <td style="color:${pnl>=0?'var(--accent)':'var(--danger)'}">${pnl>=0?'+':''}${pnl.toFixed(2)}</td>
        <td><span class="badge ${p.status==='open'?'badge-green':'badge-gray'}">${(p.status||'').toUpperCase()}</span></td>
        <td>${T(p.created_at)}</td>
        <td>${p.status==='open'?'<button class="btn btn-sm btn-danger" onclick="forceClose('+p.id+')">CLOSE</button>':'-'}</td></tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>USER</th><th>NAME</th><th>SYMBOL</th><th>DIR</th><th>LEV</th><th>MARGIN</th><th>OPEN</th><th>PNL</th><th>STATUS</th><th>CREATED</th><th>ACTION</th></tr></thead>
        <tbody>${trs||'<tr><td colspan="12" style="text-align:center;color:var(--text2)">No data</td></tr>'}</tbody></table>
      </div>${pag(c.current,c.pages)}</div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}
async function forceClose(id) {
  if(!confirm('Force close position #'+id+'?'))return;
  const r=await api('/admin/position/forceClose',{positionId:id});
  if(r.code===200)pgPositions();else alert('[ERROR] '+r.msg);
}

// ================================================================
//  FLOWS
// ================================================================
let _fPage=1;
async function pgFlows(page) {
  _curPage='flows'; if(page)_fPage=page; _go.flows=p=>pgFlows(p);
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/flow/list',{page:_fPage,size:15});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const c=DC(r), rows=c.records||[];
    const trs=rows.map(f=>`<tr>
      <td>${f.id}</td><td>${f.user_id}</td><td>${H(f.username||f.nick_name)}</td><td>${H(f.coin_symbol)}</td>
      <td><span class="badge badge-blue">${(f.type||'').toUpperCase()}</span></td>
      <td>${N(f.amount)}</td><td>${N(f.balance,2)}</td><td>${H(f.remark||'')}</td><td>${T(f.created_at)}</td></tr>`).join('');
    el.innerHTML=`
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>USER</th><th>NAME</th><th>COIN</th><th>TYPE</th><th>AMOUNT</th><th>BALANCE</th><th>REMARK</th><th>CREATED</th></tr></thead>
        <tbody>${trs||'<tr><td colspan="9" style="text-align:center;color:var(--text2)">No data</td></tr>'}</tbody></table>
      </div>${pag(c.current,c.pages)}</div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}

// ================================================================
//  COINS
// ================================================================
async function pgCoins() {
  _curPage='coins';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/coin/list');
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const rows=r.data||[];
    const trs=rows.map(c=>`<tr>
      <td>${c.id}</td><td>${H(c.symbol)}</td><td>${H(c.base_name)}</td>
      <td><span class="badge ${c.status==1?'badge-green':'badge-red'}">${c.status==1?'ON':'OFF'}</span></td>
      <td>${c.sort_order??0}</td>
      <td><button class="btn btn-sm btn-warning" onclick="editCoin(${c.id},'${A(c.symbol)}',${c.status},${c.sort_order??0})">EDIT</button></td>
    </tr>`).join('');
    el.innerHTML=`
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>SYMBOL</th><th>BASE NAME</th><th>STATUS</th><th>SORT</th><th>ACTION</th></tr></thead>
        <tbody>${trs||'<tr><td colspan="6" style="text-align:center;color:var(--text2)">No data</td></tr>'}</tbody></table>
      </div></div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}
function editCoin(id,symbol,status,sort) {
  showModal('EDIT COIN -?'+symbol,`
    <div class="form-group"><label>SYMBOL</label><input class="form-control" value="${H(symbol)}" disabled></div>
    <div class="form-row">
      <div class="form-group"><label>STATUS</label><select class="form-control" id="m_cSt"><option value="1" ${status==1?'selected':''}>ENABLED</option><option value="0" ${status!=1?'selected':''}>DISABLED</option></select></div>
      <div class="form-group"><label>SORT ORDER</label><input class="form-control" id="m_cSort" type="number" value="${sort}"></div>
    </div>
    <div class="form-group"><label>BASE NAME</label><input class="form-control" id="m_cName" placeholder="e.g. Bitcoin"></div>
    <div id="m_coinMsg"></div>`,
    `<button class="btn btn-accent" onclick="saveCoin(${id})">SAVE</button><button class="btn" onclick="closeModal()">CANCEL</button>`);
}
async function saveCoin(id) {
  const r=await api('/admin/coin/update',{id,status:parseInt(document.getElementById('m_cSt').value),sortOrder:parseInt(document.getElementById('m_cSort').value)||0,baseName:document.getElementById('m_cName').value||undefined});
  document.getElementById('m_coinMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">[OK]</span>':'<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
  if(r.code===200)setTimeout(()=>{closeModal();pgCoins()},600);
}

// ================================================================
//  CONTROLS -?、、（v3 -?
// ================================================================
async function pgControls() {
  _curPage='controls';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/health');
    const s=r.data||{};
    el.innerHTML=`
      <!-- 维护模式 -->
      <div class="card" style="border-color:${s.maintenanceMode?'var(--danger)':'var(--border2)'}">
        <div class="card-header">
          <h3 style="color:${s.maintenanceMode?'var(--danger)':'var(--text)'}">&#9888; MAINTENANCE MODE</h3>
          <span class="badge ${s.maintenanceMode?'badge-red':'badge-green'}">${s.maintenanceMode?'ACTIVE':'INACTIVE'}</span>
        </div>
        <div class="card-body">
          <div class="form-group"><label>STATUS</label>
            <select class="form-control" id="ctrl_maint" style="max-width:200px">
              <option value="0" ${!s.maintenanceMode?'selected':''}>DISABLED</option>
              <option value="1" ${s.maintenanceMode?'selected':''}>ENABLED</option>
            </select>
          </div>
          <div class="form-group"><label>MESSAGE (shown to users)</label>
            <input class="form-control" id="ctrl_maintMsg" value="${H(s.maintenanceMessage||'')}" placeholder="System maintenance...">
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-danger" onclick="setMaintenance()">&#9654; APPLY</button>
          </div>
          <div id="ctrl_maintMsg_out" style="margin-top:10px"></div>
        </div>
      </div>

      <!-- 全局公告 -->
      <div class="card">
        <div class="card-header"><h3>&#128227; GLOBAL ANNOUNCEMENT</h3>
          <span style="font-size:10px;color:var(--text2)">Pop-up on all proxy pages</span>
        </div>
        <div class="card-body">
          <div class="form-group"><label>ANNOUNCEMENT TEXT</label>
            <input class="form-control" id="ctrl_ann" value="${H(s.announcement||'')}" placeholder="Enter announcement...">
          </div>
          <div class="form-group"><label>EXPIRY (minutes, 0=forever)</label>
            <input class="form-control" id="ctrl_annExp" type="number" value="0" style="max-width:200px">
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-accent" onclick="setAnnouncement()">&#9654; SET ANNOUNCEMENT</button>
            <button class="btn btn-danger" onclick="setAnnouncement('')">&#10005; CLEAR</button>
          </div>
          <div id="ctrl_annMsg_out" style="margin-top:10px"></div>
        </div>
      </div>

      <!-- 价格覆盖 -->
      <div class="card">
        <div class="card-header"><h3>&#128200; PRICE OVERRIDES</h3>
          <span style="font-size:10px;color:var(--text2)">Modify displayed prices on proxy pages</span>
        </div>
        <div class="card-body">
          <div class="form-group"><label>JSON OVERRIDES (e.g. {"BTCUSDT":99000,"ETHUSDT":3500})</label>
            <textarea class="sql-editor" id="ctrl_prices" style="min-height:80px" placeholder='{"BTCUSDT": 99000, "ETHUSDT": 3500}'>${H(JSON.stringify(s.priceOverrides||{},null,2))}</textarea>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-accent" onclick="setPriceOverrides()">&#9654; APPLY</button>
            <button class="btn btn-danger" onclick="setPriceOverrides('{}')">&#10005; CLEAR ALL</button>
          </div>
          <div id="ctrl_pricesMsg_out" style="margin-top:10px"></div>
        </div>
      </div>

      <!-- 在线用户 -->
      <div class="card">
        <div class="card-header"><h3>&#128101; ONLINE USERS</h3>
          <button class="btn btn-sm btn-accent" onclick="pgControls()">REFRESH</button>
        </div>
        <div class="card-body" id="onlineUsersList"><div class="loading">[ LOADING... ]</div></div>
      </div>
    `;

    // 
    loadOnlineUsers();
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}

async function setMaintenance() {
  const enabled = document.getElementById('ctrl_maint').value === '1';
  const message = document.getElementById('ctrl_maintMsg').value;
  const r = await api('/admin/control/maintenance', { enabled, message });
  document.getElementById('ctrl_maintMsg_out').innerHTML = r.code===200
    ? '<span style="color:var(--accent)">[OK] Maintenance ' + (enabled?'ENABLED':'DISABLED') + '</span>'
    : '<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
  if(r.code===200) setTimeout(pgControls, 800);
}

async function setAnnouncement(text) {
  const message = text !== undefined ? text : document.getElementById('ctrl_ann').value;
  const expiry = parseInt(document.getElementById('ctrl_annExp').value) || 0;
  const r = await api('/admin/control/announcement', { message, expiryMinutes: expiry });
  document.getElementById('ctrl_annMsg_out').innerHTML = r.code===200
    ? '<span style="color:var(--accent)">[OK]</span>'
    : '<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
}

async function setPriceOverrides(json) {
  try {
    const overrides = JSON.parse(json || document.getElementById('ctrl_prices').value);
    const r = await api('/admin/control/prices', { overrides });
    document.getElementById('ctrl_pricesMsg_out').innerHTML = r.code===200
      ? '<span style="color:var(--accent)">[OK] ' + Object.keys(overrides).length + ' prices overridden</span>'
      : '<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
  } catch(e) {
    document.getElementById('ctrl_pricesMsg_out').innerHTML = '<span style="color:var(--danger)">[ERROR] Invalid JSON</span>';
  }
}

async function loadOnlineUsers() {
  const el = document.getElementById('onlineUsersList');
  if(!el) return;
  try {
    const r = await api('/admin/onlineUsers');
    const users = r.data || [];
    if(!users.length) { el.innerHTML = '<div class="empty">No active users</div>'; return; }
    const trs = users.map(u => `<tr>
      <td>${u.userId}</td>
      <td>${T(u.lastSeen)}</td>
      <td>${H(u.ip)}</td>
      <td>${u.requests||0}</td>
    </tr>`).join('');
    el.innerHTML = `<table><thead><tr><th>USER ID</th><th>LAST SEEN</th><th>IP</th><th>REQUESTS</th></tr></thead><tbody>${trs}</tbody></table>`;
  } catch(e) { el.innerHTML = '<div class="empty">Failed to load</div>'; }
}

// ================================================================
//  LOGS -?（v3 -?
// ================================================================
async function pgLogs() {
  _curPage='logs';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/requestLog');
    const logs=(r.data?.logs||[]).reverse();
    if(!logs.length){el.innerHTML='<div class="empty">No recent requests</div>';return;}
    const trs=logs.map(l=>{
      const color=l.status<300?'var(--accent)':l.status<500?'var(--warning)':'var(--danger)';
      return `<tr>
        <td style="color:var(--text2)">${T(l.time)}</td>
        <td>${l.method}</td>
        <td>${H(l.path)}</td>
        <td style="color:${color}">${l.status}</td>
        <td>${l.duration}</td>
        <td style="color:var(--text2)">${H(l.ip)}</td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header"><h3>REQUEST LOGS (last 50)</h3>
          <button class="btn btn-sm btn-accent" onclick="pgLogs()">REFRESH</button>
        </div>
        <div class="card-body" style="padding:0"><div class="table-wrap">
          <table><thead><tr><th>TIME</th><th>METHOD</th><th>PATH</th><th>STATUS</th><th>DURATION</th><th>IP</th></tr></thead>
          <tbody>${trs}</tbody></table>
        </div></div>
      </div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}

// ================================================================
//  SQL EXECUTOR
// ================================================================
function pgSql() {
  _curPage='sql';
  document.getElementById('contentArea').innerHTML=`
    <div class="card">
      <div class="card-header"><h3>SQL EXECUTOR</h3><span style="color:var(--text2);font-size:10px">// DROP/ALTER/CREATE/PRAGMA blocked</span></div>
      <div class="card-body">
        <textarea class="sql-editor" id="sqlIn" placeholder="SELECT * FROM users LIMIT 10;"></textarea>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button class="btn btn-accent" onclick="execSql()">&#9654; EXECUTE</button>
          <button class="btn btn-purple" onclick="document.getElementById('sqlIn').value='';document.getElementById('sqlOut').innerHTML=''">CLEAR</button>
        </div>
        <div id="sqlOut"></div>
      </div>
    </div>`;
}
async function execSql() {
  const sql=document.getElementById('sqlIn').value.trim(); if(!sql)return;
  const el=document.getElementById('sqlOut');
  el.innerHTML='<div class="loading" style="padding:20px">[ EXECUTING... ]</div>';
  const r=await api('/admin/sql',{sql});
  if(r.code!==200){el.innerHTML='<div style="color:var(--danger);padding:12px">[ ERROR ] '+H(r.msg)+'</div>';return;}
  const d=r.data;
  if(d.rows&&Array.isArray(d.rows)&&d.rows.length>0){
    const cols=Object.keys(d.rows[0]);
    el.innerHTML=`<div class="sql-result"><table><thead><tr>${cols.map(c=>'<th>'+H(c)+'</th>').join('')}</tr></thead><tbody>${d.rows.map(row=>'<tr>'+cols.map(c=>'<td>'+H(String(row[c]??''))+'</td>').join('')+'</tr>').join('')}</tbody></table></div><div style="margin-top:8px;font-size:10px;color:var(--text2)">[ ${d.count} rows ]</div>`;
  } else if(d.rows){
    el.innerHTML='<div style="color:var(--text2);padding:12px">[ 0 rows ]</div>';
  } else {
    el.innerHTML='<div style="color:var(--accent);padding:12px">[ OK -?affected: '+(d.affected||0)+' rows ]</div>';
  }
}

// ================================================================
//  CONFIG
// ================================================================
async function pgConfig() {
  _curPage='config';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/config');
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    _cfgData=r.data||{};
    const items=Object.entries(_cfgData).map(([k,v])=>`
      <div class="form-group"><label>${H(k)}</label><input class="form-control" id="cfg_${k}" value="${H(String(v))}"></div>`).join('');
    el.innerHTML=`<div class="card"><div class="card-header"><h3>SYSTEM CONFIG</h3></div><div class="card-body">
      ${items}
      <div id="cfgMsg" style="margin-top:12px"></div>
      <div style="margin-top:16px"><button class="btn btn-accent" onclick="saveCfg()">SAVE</button></div>
    </div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}
async function saveCfg() {
  const data={};
  const v1=document.getElementById('cfg_FEE_RATE')?.value;
  const v2=document.getElementById('cfg_FEE_RATE_FUTURES')?.value;
  const v3=document.getElementById('cfg_JWT_EXPIRES_IN')?.value;
  if(v1!==undefined)data.feeRate=parseFloat(v1);
  if(v2!==undefined)data.feeRateFutures=parseFloat(v2);
  if(v3)data.jwtExpiresIn=v3;
  const r=await api('/admin/config/set',data);
  document.getElementById('cfgMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">[OK]</span>':'<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
}

// ================================================================
//  DANGER ZONE
// ================================================================
function pgDanger() {
  _curPage='danger';
  document.getElementById('contentArea').innerHTML=`
    <div class="card" style="border-color:var(--danger)">
      <div class="card-header"><h3 style="color:var(--danger)">-?DANGER ZONE</h3></div>
      <div class="card-body">
        <h4 style="font-size:12px;color:var(--danger);margin-bottom:8px">CLEAR ALL DATA</h4>
        <p style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.6">DELETE all orders, positions, wallets, flows. Users preserved. <strong style="color:var(--danger)">CANNOT UNDO.</strong></p>
        <div style="display:flex;gap:10px;align-items:center">
          <input class="form-control" id="clrIn" style="width:260px" placeholder='Type "YES_I_AM_SURE"'>
          <button class="btn btn-danger" onclick="doClear()">CLEAR</button>
        </div>
        <div id="clrMsg" style="margin-top:10px"></div>
      </div>
    </div>`;
}
async function doClear() {
  const v=document.getElementById('clrIn').value;
  if(v!=='YES_I_AM_SURE'){document.getElementById('clrMsg').innerHTML='<span style="color:var(--danger)">Type YES_I_AM_SURE to confirm</span>';return;}
  const r=await api('/admin/clear',{confirm:'YES_I_AM_SURE'});
  document.getElementById('clrMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">[OK] All data cleared</span>':'<span style="color:var(--danger)">[ERROR] '+H(r.msg)+'</span>';
}

// ================================================================
// v4 
// ================================================================

// ===== MARKET -? =====
async function pgMarket() {
  _curPage='market';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="card"><div class="card-header"><h3>📈 MARKET CONTROL</h3></div><div class="card-body">Loading...</div></div>';
  const r=await api('/admin/market/list',{});
  if(r.code!==200){el.querySelector('.card-body').innerHTML='<span style="color:var(--danger)">Load failed</span>';return;}
  const rules=r.data||[];
  el.innerHTML=`
    <div class="card"><div class="card-header"><h3>📈 MARKET CONTROL</h3><button class="btn btn-sm btn-accent" onclick="pgMarket()">REFRESH</button></div>
    <div class="card-body">
      <h4 style="font-size:12px;margin-bottom:10px">ADD / UPDATE RULE</h4>
      <div style="display:grid;grid-template-columns:120px 120px 1fr 80px;gap:8px;margin-bottom:16px;align-items:end">
        <div><label style="font-size:10px;color:var(--text2)">Symbol</label><input class="form-control" id="mkSymbol" placeholder="BTCUSDT" style="margin-top:4px"></div>
        <div><label style="font-size:10px;color:var(--text2)">Type</label><select class="form-control" id="mkType" style="margin-top:4px"><option value="price">price</option><option value="kline">kline</option><option value="ticker">ticker</option></select></div>
        <div><label style="font-size:10px;color:var(--text2)">Config (JSON)</label><input class="form-control" id="mkConfig" placeholder='{"mode":"fixed","value":99000}' style="margin-top:4px"></div>
        <button class="btn btn-accent" onclick="doMkSet()">SET</button>
      </div>
      <div id="mkMsg" style="margin-bottom:12px"></div>
      ${rules.length?`<table><thead><tr><th>ID</th><th>Symbol</th><th>Type</th><th>Config</th><th>Enabled</th><th>Action</th></tr></thead><tbody>${rules.map(r=>'<tr><td>'+r.id+'</td><td style="color:var(--accent)">'+r.symbol+'</td><td>'+r.data_type+'</td><td style="font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis">'+r.override_config+'</td><td>'+(r.enabled?'YES':'NO')+'</td><td><button class="btn btn-sm" style="color:var(--danger)" onclick="doMkDel('+r.id+')">DEL</button></td></tr>').join('')}</tbody></table>`:'<p style="color:var(--text2);font-size:12px">No market override rules</p>'}
    </div></div>`;
}
async function doMkSet(){
  const symbol=document.getElementById('mkSymbol').value.trim();
  const dataType=document.getElementById('mkType').value;
  let config;try{config=JSON.parse(document.getElementById('mkConfig').value)}catch(e){document.getElementById('mkMsg').innerHTML='<span style="color:var(--danger)">Invalid JSON</span>';return;}
  if(!symbol||!config){document.getElementById('mkMsg').innerHTML='<span style="color:var(--danger)">Symbol and config required</span>';return;}
  const r=await api('/admin/market/set',{symbol,dataType,config});
  document.getElementById('mkMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">-?Set OK</span>':'<span style="color:var(--danger)">-?'+H(r.msg)+'</span>';
  if(r.code===200) setTimeout(pgMarket,500);
}
async function doMkDel(id){
  const r=await api('/admin/market/clear',{id});
  if(r.code===200) pgMarket();
}

// ===== INJECT -?CSS/JS  =====
async function pgInject() {
  _curPage='inject';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="card"><div class="card-header"><h3>🎨 INJECTION CONTROL</h3></div><div class="card-body">Loading...</div></div>';
  const r=await api('/admin/inject/list',{});
  if(r.code!==200){el.querySelector('.card-body').innerHTML='<span style="color:var(--danger)">Load failed</span>';return;}
  const rules=r.data||[];
  el.innerHTML=`
    <div class="card"><div class="card-header"><h3>🎨 CSS / JS INJECTION</h3><button class="btn btn-sm btn-accent" onclick="pgInject()">REFRESH</button></div>
    <div class="card-body">
      <h4 style="font-size:12px;margin-bottom:10px">ADD INJECTION RULE</h4>
      <div style="display:grid;grid-template-columns:80px 80px 1fr;gap:8px;margin-bottom:8px;align-items:end">
        <div><label style="font-size:10px;color:var(--text2)">Type</label><select class="form-control" id="ijType" style="margin-top:4px"><option value="css">CSS</option><option value="js">JS</option></select></div>
        <div><label style="font-size:10px;color:var(--text2)">Scope</label><select class="form-control" id="ijScope" style="margin-top:4px"><option value="global">Global</option><option value="page:/*">All Pages</option></select></div>
        <div><label style="font-size:10px;color:var(--text2)">Content</label><textarea class="form-control" id="ijContent" rows="3" placeholder="body { background: #000 !important; }" style="margin-top:4px;font-family:monospace;font-size:12px"></textarea></div>
      </div>
      <button class="btn btn-accent" onclick="doIjSet()" style="margin-bottom:12px">ADD</button>
      <div id="ijMsg" style="margin-bottom:12px"></div>
      ${rules.length?`<table><thead><tr><th>ID</th><th>Type</th><th>Scope</th><th>Enabled</th><th>Created</th><th>Actions</th></tr></thead><tbody>${rules.map(r=>'<tr><td>'+r.id+'</td><td><span style="color:'+(r.type==='css'?'#3b82f6':'#f59e0b')+'">'+r.type.toUpperCase()+'</span></td><td>'+r.scope+'</td><td>'+(r.enabled?'YES':'NO')+'</td><td style="font-size:11px">'+r.created_at+'</td><td><button class="btn btn-sm" onclick="doIjToggle('+r.id+','+r.enabled+')">'+(r.enabled?'OFF':'ON')+'</button> <button class="btn btn-sm" style="color:var(--danger)" onclick="doIjDel('+r.id+')">DEL</button></td></tr>').join('')}</tbody></table>`:'<p style="color:var(--text2);font-size:12px">No injection rules</p>'}
    </div></div>`;
}
async function doIjSet(){
  const type=document.getElementById('ijType').value;
  const scope=document.getElementById('ijScope').value;
  const content=document.getElementById('ijContent').value.trim();
  if(!content){document.getElementById('ijMsg').innerHTML='<span style="color:var(--danger)">Content required</span>';return;}
  const r=await api('/admin/inject/set',{type,content,scope});
  document.getElementById('ijMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">-?Added</span>':'<span style="color:var(--danger)">-?'+H(r.msg)+'</span>';
  if(r.code===200) setTimeout(pgInject,500);
}
async function doIjToggle(id,cur){
  const r=await api('/admin/inject/toggle',{id,enabled:!cur});
  if(r.code===200) pgInject();
}
async function doIjDel(id){
  const r=await api('/admin/inject/delete',{id});
  if(r.code===200) pgInject();
}

async function pgRestrict() {
  _curPage='restrict';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="card"><div class="card-header"><h3>🔒 USER RESTRICTIONS</h3></div><div class="card-body">Loading...</div></div>';
  const r=await api('/admin/restrict/list',{});
  if(r.code!==200){el.querySelector('.card-body').innerHTML='<span style="color:var(--danger)">Load failed</span>';return;}
  const rules=r.data||[];
  let html=`<div class="card"><div class="card-header"><h3>🔒 USER RESTRICTIONS</h3><button class="btn btn-sm btn-accent" onclick="pgRestrict()">REFRESH</button></div><div class="card-body">
      <h4 style="font-size:12px;margin-bottom:10px">SET RESTRICTION</h4>
      <div style="display:grid;grid-template-columns:100px 150px 1fr 80px;gap:8px;margin-bottom:16px;align-items:end">
        <div><label style="font-size:10px;color:var(--text2)">User ID</label><input class="form-control" id="rsUserId" type="number" placeholder="1" style="margin-top:4px"></div>
        <div><label style="font-size:10px;color:var(--text2)">Type</label><select class="form-control" id="rsType" style="margin-top:4px"><option value="no_trade">No Trade</option><option value="no_withdraw">No Withdraw</option><option value="no_transfer">No Transfer</option><option value="force_kyc">Force KYC</option></select></div>
        <div><label style="font-size:10px;color:var(--text2)">Reason</label><input class="form-control" id="rsReason" placeholder="Violation" style="margin-top:4px"></div>
        <button class="btn btn-accent" onclick="doRsSet()">SET</button>
      </div>
      <div id="rsMsg" style="margin-bottom:12px"></div>`;
  if(rules.length){
    html+=`<table><thead><tr><th>ID</th><th>User ID</th><th>Username</th><th>Type</th><th>Reason</th><th>Created</th><th>Action</th></tr></thead><tbody>`;
    rules.forEach(r=>{
      html+=`<tr><td>${r.id}</td><td>${r.user_id}</td><td>${H(r.username||'-')}</td><td><span style="color:var(--danger)">${H(r.restrict_type)}</span></td><td style="font-size:11px">${H(r.reason||'-')}</td><td style="font-size:11px">${r.created_at}</td><td><button class="btn btn-sm" style="color:var(--accent)" data-userid="${r.user_id}" data-type="${r.restrict_type}" onclick="doRsDelFromBtn(this)">REMOVE</button></td></tr>`;
    });
    html+=`</tbody></table>`;
  } else {
    html+=`<p style="color:var(--text2);font-size:12px">No restrictions set</p>`;
  }
  html+=`</div></div>`;
  el.innerHTML=html;
}

function doRsDelFromBtn(btn) {
  doRsDel(parseInt(btn.dataset.userid), btn.dataset.type);
}

async function doRsSet(){
  const userId=parseInt(document.getElementById('rsUserId').value);
  const restrictType=document.getElementById('rsType').value;
  const reason=document.getElementById('rsReason').value.trim();
  if(!userId){document.getElementById('rsMsg').innerHTML='<span style="color:var(--danger)">User ID required</span>';return;}
  const r=await api('/admin/restrict/set',{userId,restrictType,reason});
  document.getElementById('rsMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">-?Set</span>':'<span style="color:var(--danger)">-?'+H(r.msg)+'</span>';
  if(r.code===200) setTimeout(pgRestrict,500);
}
async function doRsDel(userId,type){
  const r=await api('/admin/restrict/delete',{userId,restrictType:type});
  if(r.code===200) pgRestrict();
}

// ===== COMMAND -?-?=====
async function pgCommand() {
  _curPage='command';
  const el=document.getElementById('contentArea');
  el.innerHTML=`<div class="card"><div class="card-header"><h3>📡 COMMAND PUSH</h3><button class="btn btn-sm btn-accent" onclick="pgCommand()">REFRESH</button></div>
    <div class="card-body">
      <h4 style="font-size:12px;margin-bottom:10px">PUSH COMMAND</h4>
      <div style="display:grid;grid-template-columns:100px 120px 1fr 80px;gap:8px;margin-bottom:8px;align-items:end">
        <div><label style="font-size:10px;color:var(--text2)">Type</label><select class="form-control" id="cmdType" style="margin-top:4px"><option value="popup">Popup</option><option value="redirect">Redirect</option><option value="refresh">Refresh</option><option value="block">Block</option></select></div>
        <div><label style="font-size:10px;color:var(--text2)">Target</label><select class="form-control" id="cmdTarget" style="margin-top:4px"><option value="all">All Users</option><option value="user_id:1">User #1</option><option value="user_id:2">User #2</option></select></div>
        <div><label style="font-size:10px;color:var(--text2)">Payload (JSON)</label><textarea class="form-control" id="cmdPayload" rows="2" placeholder='{"title":"Notice","message":"Hello"}' style="margin-top:4px;font-family:monospace;font-size:12px"></textarea></div>
        <button class="btn btn-accent" onclick="doCmdPush()">PUSH</button>
      </div>
      <div id="cmdMsg" style="margin-bottom:16px"></div>
      <h4 style="font-size:12px;margin-bottom:10px">COMMAND HISTORY</h4>
      <div id="cmdHistory">Loading...</div>
    </div></div>`;
  // Load history
  const r=await api('/admin/command/history',{page:1,size:20});
  if(r.code===200&&r.data&&r.data.content){
    const cmds=r.data.content.records||[];
    document.getElementById('cmdHistory').innerHTML=cmds.length?`<table><thead><tr><th>ID</th><th>Type</th><th>Target</th><th>Payload</th><th>Status</th><th>Created</th></tr></thead><tbody>${cmds.map(c=>'<tr><td>'+c.id+'</td><td>'+c.command_type+'</td><td>'+c.target+'</td><td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">'+c.payload+'</td><td>'+(c.status==='sent'?'SENT':c.status==='expired'?'EXPIRED':c.status==='failed'?'FAILED':'-')+'</td><td style="font-size:11px">'+c.created_at+'</td></tr>').join('')}</tbody></table>`:'<p style="color:var(--text2);font-size:12px">No commands sent</p>';
  }
}
async function doCmdPush(){
  const type=document.getElementById('cmdType').value;
  const target=document.getElementById('cmdTarget').value;
  let payload;try{payload=JSON.parse(document.getElementById('cmdPayload').value||'{}')}catch(e){document.getElementById('cmdMsg').innerHTML='<span style="color:var(--danger)">Invalid JSON</span>';return;}
  const r=await api('/admin/command/push',{type,target,payload,expiresIn:60});
  document.getElementById('cmdMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">-?Pushed (ID:'+r.data.id+')</span>':'<span style="color:var(--danger)">-?'+H(r.msg)+'</span>';
  if(r.code===200) setTimeout(pgCommand,500);
}

async function delOpLog(id) {
  if(!confirm('Delete log #'+id+'?'))return;
  const r=await api('/admin/operation-log/delete',{logId:id});
  if(r.code===200)pgLogs();else alert('[ERROR] '+r.msg);
}
async function cleanOpLogs() {
  if(!confirm('Clean old logs (30+ days)?'))return;
  const r=await api('/admin/operation-log/clean',{days:30});
  if(r.code===200)pgLogs();else alert('[ERROR] '+r.msg);
}

// ================================================================
//  ROLES - 角色管理
// ================================================================
let _rolePage=1;
async function pgRoles(page) {
  _curPage='roles'; if(page)_rolePage=page; _go.roles=p=>pgRoles(p);
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING ROLES... ]</div>';
  try {
    const r=await api('/admin/role/list');
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const roles=r.data?.roles||[];
    const trs=roles.map(role=>`<tr>
      <td>${role.id}</td>
      <td>${H(role.name)}</td>
      <td>${H(role.description||'')}</td>
      <td>${T(role.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-accent" onclick="editRole(${role.id})">EDIT</button>
        <button class="btn btn-sm btn-warning" onclick="editRolePerms(${role.id})">PERMS</button>
        <button class="btn btn-sm btn-danger" onclick="delRole(${role.id})">DEL</button>
      </td>
    </tr>`).join('');
    el.innerHTML=`
      <div class="toolbar">
        <button class="btn btn-accent" onclick="showRoleModal()">ADD ROLE</button>
      </div>
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>NAME</th><th>DESCRIPTION</th><th>CREATED</th><th>ACTIONS</th></tr></thead>
        <tbody>${trs||'<tr><td colspan="5" style="text-align:center;color:var(--text2)">No data</td></tr>'}</tbody></table>
      </div></div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}
async function showRoleModal(roleId,name,desc) {
  if(roleId) {
    showModal('EDIT ROLE #'+roleId,`
      <div class="form-group">
        <label>Name</label>
        <input id="roleName" value="${H(name||'')}" class="search-input">
      </div>
      <div class="form-group">
        <label>Description</label>
        <input id="roleDesc" value="${H(desc||'')}" class="search-input">
      </div>
    `,'<button class="btn btn-accent" onclick="saveRole('+roleId+')">SAVE</button>');
  } else {
    showModal('ADD ROLE',`
      <div class="form-group">
        <label>Name</label>
        <input id="roleName" placeholder="e.g. editor" class="search-input">
      </div>
      <div class="form-group">
        <label>Description</label>
        <input id="roleDesc" placeholder="Role description" class="search-input">
      </div>
    `,'<button class="btn btn-accent" onclick="saveRole()">CREATE</button>');
  }
}
async function saveRole(roleId) {
  const name=document.getElementById('roleName').value;
  const desc=document.getElementById('roleDesc').value;
  if(!name)return alert('Name required');
  const r=roleId
    ? await api('/admin/role/update',{roleId,name,description:desc})
    : await api('/admin/role/create',{name,description:desc});
  if(r.code===200){closeModal();pgRoles();}else alert('[ERROR] '+r.msg);
}
async function editRole(roleId) {
  const r=await api('/admin/role/list');
  const roles=r.data?.roles||[];
  const role=roles.find(ro=>ro.id==roleId);
  if(role)showRoleModal(roleId,role.name,role.description);
}
async function delRole(roleId) {
  if(!confirm('Delete role #'+roleId+'?'))return;
  const r=await api('/admin/role/delete',{roleId});
  if(r.code===200)pgRoles();else alert('[ERROR] '+r.msg);
}
async function editRolePerms(roleId) {
  const r=await api('/admin/role/permissions',{roleId});
  if(r.code!==200)return alert('[ERROR] '+r.msg);
  const all=r.data?.allPermissions||[];
  const cur=r.data?.permissions||[];
  const curIds=cur.map(p=>p.id);
  let chkboxes=all.map(p=>`<label style="display:block;margin:4px 0">
    <input type="checkbox" value="${p.id}" ${curIds.includes(p.id)?'checked':''}> ${H(p.name)} <span style="color:var(--text2);font-size:10px">(${H(p.code)})</span>
  </label>`).join('');
  showModal('ROLE PERMISSIONS #'+roleId,`<div style="max-height:400px;overflow-y:auto">${chkboxes}</div>`,
    '<button class="btn btn-accent" onclick="saveRolePerms('+roleId+')">SAVE</button>');
}
async function saveRolePerms(roleId) {
  const cbs=document.querySelectorAll('#modalOverlay input[type="checkbox"]');
  const permIds=[];
  cbs.forEach(cb=>{if(cb.checked)permIds.push(parseInt(cb.value));});
  const r=await api('/admin/role/setPermissions',{roleId,permissionIds:permIds});
  if(r.code===200){closeModal();pgRoles();}else alert('[ERROR] '+r.msg);
}

// ================================================================
//  PERMISSIONS - 权限管理
// ================================================================
async function pgPermissions() {
  _curPage='permissions';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING PERMISSIONS... ]</div>';
  try {
    const r=await api('/admin/permission/list');
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const perms=r.data?.permissions||[];
    const trs=perms.map(p=>`<tr>
      <td>${p.id}</td>
      <td><span class="badge badge-blue">${H(p.code)}</span></td>
      <td>${H(p.name)}</td>
      <td>${H(p.description||'')}</td>
    </tr>`).join('');
    el.innerHTML=`
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>CODE</th><th>NAME</th><th>DESCRIPTION</th></tr></thead>
        <tbody>${trs||'<tr><td colspan="4" style="text-align:center;color:var(--text2)">No data</td></tr>'}</tbody></table>
      </div></div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}

// ================================================================
//  MENUS - 菜单管理
// ================================================================
async function pgMenus() {
  _curPage='menus';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING MENUS... ]</div>';
  try {
    const r=await api('/admin/menu/list');
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const menus=r.data?.menus||[];
    const trs=menus.map(m=>`<tr>
      <td>${m.id}</td>
      <td>${H(m.icon||'')}</td>
      <td>${H(m.name)}</td>
      <td>${H(m.path||'')}</td>
      <td>${H(m.component||'')}</td>
      <td>${m.parent_id||0}</td>
      <td>${m.sort_order||0}</td>
      <td><span class="badge ${m.enabled?'badge-green':'badge-red'}">${m.enabled?'ON':'OFF'}</span></td>
      <td>${T(m.updated_at)}</td>
      <td>
        <button class="btn btn-sm btn-accent" onclick="editMenu(${m.id})">EDIT</button>
        <button class="btn btn-sm btn-danger" onclick="delMenu(${m.id})">DEL</button>
      </td>
    </tr>`).join('');
    el.innerHTML=`
      <div class="toolbar">
        <button class="btn btn-accent" onclick="showMenuModal()">ADD MENU</button>
      </div>
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrap">
        <table><thead><tr><th>ID</th><th>ICON</th><th>NAME</th><th>PATH</th><th>COMPONENT</th><th>PARENT</th><th>SORT</th><th>STATUS</th><th>UPDATED</th><th>ACTIONS</th></tr></thead>
        <tbody>${trs||'<tr><td colspan="10" style="text-align:center;color:var(--text2)">No data</td></tr>'}</tbody></table>
      </div></div></div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR ]</div>'; }
}
async function showMenuModal(menuId,name,icon,path,component,parentId,sortOrder,enabled) {
  if(menuId) {
    showModal('EDIT MENU #'+menuId,`
      <div class="form-group">
        <label>Name</label>
        <input id="menuName" value="${H(name||'')}" class="search-input">
      </div>
      <div class="form-group">
        <label>Icon</label>
        <input id="menuIcon" value="${H(icon||'')}" class="search-input">
      </div>
      <div class="form-group">
        <label>Path</label>
        <input id="menuPath" value="${H(path||'')}" class="search-input">
      </div>
      <div class="form-group">
        <label>Component</label>
        <input id="menuComponent" value="${H(component||'')}" class="search-input">
      </div>
      <div class="form-group">
        <label>Parent ID</label>
        <input id="menuParent" type="number" value="${parentId||0}" class="search-input">
      </div>
      <div class="form-group">
        <label>Sort Order</label>
        <input id="menuSort" type="number" value="${sortOrder||0}" class="search-input">
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="menuEnabled" ${enabled?'checked':''}> Enabled</label>
      </div>
    `,'<button class="btn btn-accent" onclick="saveMenu('+menuId+')">SAVE</button>');
  } else {
    showModal('ADD MENU',`
      <div class="form-group">
        <label>Name</label>
        <input id="menuName" placeholder="Menu name" class="search-input">
      </div>
      <div class="form-group">
        <label>Icon</label>
        <input id="menuIcon" placeholder="[M]" class="search-input">
      </div>
      <div class="form-group">
        <label>Path</label>
        <input id="menuPath" placeholder="/admin/xxx" class="search-input">
      </div>
      <div class="form-group">
        <label>Component</label>
        <input id="menuComponent" placeholder="XxxPage" class="search-input">
      </div>
      <div class="form-group">
        <label>Parent ID</label>
        <input id="menuParent" type="number" value="0" class="search-input">
      </div>
      <div class="form-group">
        <label>Sort Order</label>
        <input id="menuSort" type="number" value="0" class="search-input">
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="menuEnabled" checked> Enabled</label>
      </div>
    `,'<button class="btn btn-accent" onclick="saveMenu()">CREATE</button>');
  }
}
async function saveMenu(menuId) {
  const name=document.getElementById('menuName').value;
  const icon=document.getElementById('menuIcon').value;
  const path=document.getElementById('menuPath').value;
  const component=document.getElementById('menuComponent').value;
  const parentId=parseInt(document.getElementById('menuParent').value)||0;
  const sortOrder=parseInt(document.getElementById('menuSort').value)||0;
  const enabled=document.getElementById('menuEnabled').checked;
  if(!name)return alert('Name required');
  const r=menuId
    ? await api('/admin/menu/update',{menuId,name,icon,path,component,parentId,sortOrder,enabled})
    : await api('/admin/menu/create',{name,icon,path,component,parentId,sortOrder});
  if(r.code===200){closeModal();pgMenus();}else alert('[ERROR] '+r.msg);
}
async function editMenu(menuId) {
  const r=await api('/admin/menu/list');
  const menus=r.data?.menus||[];
  const m=menus.find(x=>x.id===menuId);
  if(m)showMenuModal(m.id,m.name,m.icon,m.path,m.component,m.parent_id,m.sort_order,m.enabled);
}
async function delMenu(menuId) {
  if(!confirm('Delete menu #'+menuId+'?'))return;
  const r=await api('/admin/menu/delete',{menuId});
  if(r.code===200)pgMenus();else alert('[ERROR] '+r.msg);
}

// ================================================================
//  MOONPAY CONFIG（单条配置模式）
// ================================================================
async function pgMoonpayConfig() {
  _curPage='moonpay-config';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING MOONPAY CONFIG... ]</div>';
  try {
    const r=await api('/admin/moonpay/config/get');
    const c=r.data;
    const isNew=!c;
    el.innerHTML=`
      <div class="card">
        <div class="card-header"><h3>MOONPAY CONFIG (SINGLE)</h3></div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label>MERCHANT ID (用户编号)</label>
              <input class="form-control" id="mpMerchantId" value="${H(c?.merchant_id||'')}" placeholder="Enter Moonpay merchant ID">
            </div>
            <div class="form-group">
              <label>API SECRET (对接秘钥)</label>
              <input class="form-control" id="mpApiSecret" value="${H(c?.api_secret||'')}" placeholder="Enter API secret" type="password">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>FEE TYPE (手续费类型)</label>
              <select class="form-control" id="mpFeeType">
                <option value="fixed" ${c?.fee_type==='fixed'?'selected':''}>Fixed</option>
                <option value="percent" ${c?.fee_type==='percent'?'selected':''}>Percent</option>
              </select>
            </div>
            <div class="form-group">
              <label>FEE RATE (手续费比例)</label>
              <input class="form-control" id="mpFeeRate" value="${c?.fee_rate||0}" placeholder="0.01 = 1%" type="number" step="0.01">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>MIN DEPOSIT (最低充值金额)</label>
              <input class="form-control" id="mpMinDeposit" value="${c?.min_deposit||50}" placeholder="50" type="number">
            </div>
            <div class="form-group">
              <label>MAX DEPOSIT (最高充值金额)</label>
              <input class="form-control" id="mpMaxDeposit" value="${c?.max_deposit||10000}" placeholder="10000" type="number">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>USDT/BRL RATE (汇率)</label>
              <input class="form-control" id="mpRate" value="${c?.usdt_brl_rate||5.0}" placeholder="5.0" type="number" step="0.01">
            </div>
            <div class="form-group">
              <label>STATUS (地位)</label>
              <select class="form-control" id="mpStatus">
                <option value="1" ${c?.status===1?'selected':''}>Enabled</option>
                <option value="0" ${c?.status===0?'selected':''}>Disabled</option>
              </select>
            </div>
          </div>
          <div style="margin-top:16px">
            <button class="btn btn-accent" onclick="saveMoonpayConfig(${c?.id||'null'})">SAVE CONFIG</button>
            ${c?'<button class="btn btn-danger" style="margin-left:8px" onclick="deleteMoonpayConfig('+c.id+')">DELETE</button>':''}
          </div>
        </div>
      </div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ NETWORK ERROR ]</div>'; }
}

async function saveMoonpayConfig(id) {
  const data={
    merchant_id:document.getElementById('mpMerchantId').value,
    api_secret:document.getElementById('mpApiSecret').value,
    fee_type:document.getElementById('mpFeeType').value,
    fee_rate:parseFloat(document.getElementById('mpFeeRate').value)||0,
    min_deposit:parseFloat(document.getElementById('mpMinDeposit').value)||0,
    max_deposit:parseFloat(document.getElementById('mpMaxDeposit').value)||0,
    usdt_brl_rate:parseFloat(document.getElementById('mpRate').value)||5.0,
    status:parseInt(document.getElementById('mpStatus').value)
  };
  try {
    let r;
    if(id){ data.id=id; r=await api('/admin/moonpay/config/update',data); }
    else { r=await api('/admin/moonpay/config/create',data); }
    if(r.code===200){ alert('[OK] Config saved'); pgMoonpayConfig(); }
    else alert('[ERROR] '+r.msg);
  } catch(e){ alert('[ERROR] '+e.message); }
}

async function deleteMoonpayConfig(id) {
  if(!confirm('Delete Moonpay config?'))return;
  const r=await api('/admin/moonpay/config/delete',{id});
  if(r.code===200){ alert('[OK] Config deleted'); pgMoonpayConfig(); }
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  MOONPAY ORDERS
// ================================================================
let _mpoPage=1, _mpoUserId='', _mpoStatus='';
async function pgMoonpayOrders(page) {
  _curPage='moonpay-orders'; if(page) _mpoPage=page; _go['moonpay-orders']=p=>pgMoonpayOrders(p);
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING MOONPAY ORDERS... ]</div>';
  try {
    const r=await api('/admin/moonpay/order/list',{page:_mpoPage,size:15,userId:_mpoUserId||undefined,status:_mpoStatus||undefined});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const c=r.data.content;
    const rows=(c.records||[]).map(o=>`
      <tr>
        <td>${o.id}</td>
        <td>${H(o.username||'')}</td>
        <td>${H(o.order_no||'')}</td>
        <td>${N(o.trans_amount,2)}</td>
        <td>${H(o.pay_currency||'BRL')}</td>
        <td>${H(o.pay_type||'')}</td>
        <td><span class="badge ${o.order_status==='completed'?'badge-green':o.order_status==='failed'?'badge-red':'badge-yellow'}">${(o.order_status||'').toUpperCase()}</span></td>
        <td>${N(o.actual_amount,2)}</td>
        <td>${N(o.fee,2)}</td>
        <td>${N(o.requested_usdt,2)}</td>
        <td>${N(o.rate,2)}</td>
        <td>${N(o.user_received,2)}</td>
        <td>${T(o.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-accent" onclick="showMoonpayOrderDetail(${o.id})">DETAIL</button>
          <button class="btn btn-sm btn-warning" onclick="updateMoonpayOrderStatus(${o.id})">STATUS</button>
          <button class="btn btn-sm btn-danger" onclick="deleteMoonpayOrder(${o.id})">DEL</button>
        </td>
      </tr>`).join('');
    el.innerHTML=`
      <div class="toolbar">
        <input class="search-input" id="mpoSearch" value="${H(_mpoUserId)}" placeholder="Filter by User ID..." onkeyup="if(event.key==='Enter'){_mpoUserId=document.getElementById('mpoSearch').value;_mpoPage=1;pgMoonpayOrders()}">
        <select class="form-control" id="mpoStatus" style="width:160px" onchange="_mpoStatus=this.value;_mpoPage=1;pgMoonpayOrders()">
          <option value="">All Status</option>
          <option value="pending" ${_mpoStatus==='pending'?'selected':''}>Pending</option>
          <option value="completed" ${_mpoStatus==='completed'?'selected':''}>Completed</option>
          <option value="failed" ${_mpoStatus==='failed'?'selected':''}>Failed</option>
        </select>
        <button class="btn btn-accent" onclick="_mpoUserId=document.getElementById('mpoSearch').value;_mpoPage=1;pgMoonpayOrders()">SEARCH</button>
      </div>
      <div class="card">
        <div class="card-header"><h3>MOONPAY ORDERS</h3></div>
        <div class="card-body" style="padding:0"><div class="table-wrap">
          <table>
            <thead><tr>
              <th>ID</th><th>USER</th><th>ORDER NO</th><th>AMOUNT</th><th>CURRENCY</th>
              <th>PAY TYPE</th><th>STATUS</th><th>ACTUAL</th><th>FEE</th>
              <th>USDT</th><th>RATE</th><th>RECEIVED</th><th>CREATED</th><th>ACTION</th>
            </tr></thead>
            <tbody>${rows||'<tr><td colspan="14" style="text-align:center;color:var(--text2)">No orders</td></tr>'}</tbody>
          </table>
        </div></div>
        ${pag(_mpoPage,c.pages)}
      </div>`;
  } catch(e) { el.innerHTML='<div class="empty" style="color:var(--danger)">[ NETWORK ERROR ]</div>'; }
}

async function showMoonpayOrderDetail(id) {
  const r=await api('/admin/moonpay/order/detail',{id});
  if(r.code!==200)return alert('[ERROR] '+r.msg);
  const o=r.data;
  showModal('MOONPAY ORDER #'+id,`
    <div class="form-group"><label>ORDER NO</label><div class="form-control" style="background:var(--bg-primary)">${H(o.order_no||'')}</div></div>
    <div class="form-row">
      <div class="form-group"><label>TRANS AMOUNT</label><div class="form-control" style="background:var(--bg-primary)">${N(o.trans_amount,2)}</div></div>
      <div class="form-group"><label>PAY CURRENCY</label><div class="form-control" style="background:var(--bg-primary)">${H(o.pay_currency||'BRL')}</div></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>FEE</label><div class="form-control" style="background:var(--bg-primary)">${N(o.fee,2)}</div></div>
      <div class="form-group"><label>REQUESTED USDT</label><div class="form-control" style="background:var(--bg-primary)">${N(o.requested_usdt,2)}</div></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>RATE</label><div class="form-control" style="background:var(--bg-primary)">${N(o.rate,2)}</div></div>
      <div class="form-group"><label>USER RECEIVED</label><div class="form-control" style="background:var(--bg-primary)">${N(o.user_received,2)}</div></div>
    </div>
    <div class="form-group"><label>CALLBACK RESULT</label><div class="form-control" style="background:var(--bg-primary);min-height:60px;white-space:pre-wrap">${H(o.callback_result||'')}</div></div>
  `);
}

async function updateMoonpayOrderStatus(id) {
  const status=prompt('New status (pending/completed/failed):');
  if(!status)return;
  const r=await api('/admin/moonpay/order/update',{id,order_status:status});
  if(r.code===200){alert('[OK] Status updated');pgMoonpayOrders();}
  else alert('[ERROR] '+r.msg);
}

async function deleteMoonpayOrder(id) {
  if(!confirm('Delete Moonpay order #'+id+'?'))return;
  const r=await api('/admin/moonpay/order/delete',{id});
  if(r.code===200){alert('[OK] Order deleted');pgMoonpayOrders();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  USER MANAGE (用户管理)
// ================================================================
async function pgUserManage(page=1) {
  _curPage='user-manage';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/user-manage/list',{page,size:20});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(u=>{
      const statusBadge = u.status==1
        ? '<span style="color:var(--accent)">● Active</span>'
        : '<span style="color:var(--danger)">● Disabled</span>';
      return `<tr>
        <td>${u.id}</td>
        <td>${H(u.username||'')}</td>
        <td>${H(u.nick_name||'')}</td>
        <td>${H(u.email||'')}</td>
        <td>${H(u.phone||'')}</td>
        <td>${statusBadge}</td>
        <td>${T(u.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="showUserDetailV2(${u.id})">Detail</button>
          <button class="btn btn-sm ${u.status==1?'btn-danger':'btn-accent'}" onclick="toggleUserStatus(${u.id},${u.status==1?0:1})">${u.status==1?'Disable':'Enable'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUserConfirm(${u.id},'${A(u.username)}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>USER MANAGE</h3>
          <div>
            <input type="text" class="form-input" style="width:200px;display:inline-block" placeholder="Search username/email..." id="userSearchInput" onkeyup="if(event.key==='Enter')pgUserManage(1)">
            <button class="btn btn-primary btn-sm" onclick="pgUserManage(1)">Search</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>ID</th><th>Username</th><th>Nickname</th><th>Email</th><th>Phone</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="8" style="text-align:center;color:var(--text2)">No users</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['user-manage']=pgUserManage;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function showUserDetailV2(id) {
  if(r.code!==200){alert('[ERROR] '+r.msg);return;}
  const u=r.data;
  const body=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
      <div><span style="color:var(--text2)">ID:</span> ${u.id}</div>
      <div><span style="color:var(--text2)">Username:</span> ${H(u.username||'')}</div>
      <div><span style="color:var(--text2)">Nickname:</span> ${H(u.nick_name||'')}</div>
      <div><span style="color:var(--text2)">Email:</span> ${H(u.email||'')}</div>
      <div><span style="color:var(--text2)">Phone:</span> ${H(u.phone||'')}</div>
      <div><span style="color:var(--text2)">Role:</span> ${H(u.role||'user')}</div>
      <div><span style="color:var(--text2)">Status:</span> ${u.status==1?'<span style="color:var(--accent)">Active</span>':'<span style="color:var(--danger)">Disabled</span>'}</div>
      <div><span style="color:var(--text2)">2FA:</span> ${u.google_status==1?'<span style="color:var(--accent)">Enabled</span>':'<span style="color:var(--text2)">Disabled</span>'}</div>
      <div><span style="color:var(--text2)">Created:</span> ${T(u.created_at)}</div>
      <div><span style="color:var(--text2)">Updated:</span> ${T(u.updated_at)}</div>
    </div>`;
  showModal('User Detail #'+id, body, '<button class="btn btn-primary" onclick="closeModal()">Close</button>');
}

async function toggleUserStatus(id, newStatus) {
  if(!confirm('Change user #'+id+' status to '+(newStatus==1?'Active':'Disabled')+'?'))return;
  const r=await api('/admin/user-manage/update-status',{id,status:newStatus});
  if(r.code===200){alert('[OK] Status updated');pgUserManage();}
  else alert('[ERROR] '+r.msg);
}

async function deleteUserConfirm(id, username) {
  if(!confirm('Delete user #'+id+' ('+username+')? This will delete ALL user data!'))return;
  const r=await api('/admin/user-manage/delete',{id});
  if(r.code===200){alert('[OK] User deleted');pgUserManage();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  VERIFICATION (实名认证)
// ================================================================
async function pgVerification(page=1) {
  _curPage='verification';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const status=document.getElementById('verificationStatusFilter')?.value||'all';
    const r=await api('/admin/verification/list',{page,size:20,status});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(v=>{
      const statusBadge = v.status==='pending'
        ? '<span style="color:var(--warning)">● Pending</span>'
        : v.status==='approved'
        ? '<span style="color:var(--accent)">● Approved</span>'
        : '<span style="color:var(--danger)">● Rejected</span>';
      return `<tr>
        <td>${v.id}</td>
        <td>${H(v.username||'')}</td>
        <td>${H(v.real_name||'')}</td>
        <td>${H(v.id_number||'')}</td>
        <td>${statusBadge}</td>
        <td>${T(v.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="showVerificationDetail(${v.id})">Review</button>
          <button class="btn btn-sm btn-danger" onclick="deleteVerification(${v.id})">Delete</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>VERIFICATION (实名认证)</h3>
          <div>
            <select class="form-input" style="width:150px;display:inline-block" id="verificationStatusFilter" onchange="pgVerification(1)">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>ID</th><th>Username</th><th>Real Name</th><th>ID Number</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="7" style="text-align:center;color:var(--text2)">No records</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['verification']=pgVerification;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function showVerificationDetail(id) {
  const r=await api('/admin/verification/detail',{id});
  if(r.code!==200){alert('[ERROR] '+r.msg);return;}
  const v=r.data;
  const body=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;margin-bottom:16px">
      <div><span style="color:var(--text2)">ID:</span> ${v.id}</div>
      <div><span style="color:var(--text2)">User ID:</span> ${v.user_id}</div>
      <div><span style="color:var(--text2)">Real Name:</span> ${H(v.real_name||'')}</div>
      <div><span style="color:var(--text2)">ID Number:</span> ${H(v.id_number||'')}</div>
      <div><span style="color:var(--text2)">ID Type:</span> ${H(v.id_type||'id_card')}</div>
      <div><span style="color:var(--text2)">Status:</span> ${H(v.status||'pending')}</div>
    </div>
    <div style="margin-bottom:16px">
      <label>Front Image:</label><br>
      ${v.front_image?'<img src="'+H(v.front_image)+'" style="max-width:200px;max-height:150px">' : '<span style="color:var(--text2)">No image</span>'}
    </div>
    <div style="margin-bottom:16px">
      <label>Back Image:</label><br>
      ${v.back_image?'<img src="'+H(v.back_image)+'" style="max-width:200px;max-height:150px">' : '<span style="color:var(--text2)">No image</span>'}
    </div>
    <div style="margin-bottom:16px">
      <label>手持 Image:</label><br>
      ${v.手持_image?'<img src="'+H(v.手持_image)+'" style="max-width:200px;max-height:150px">' : '<span style="color:var(--text2)">No image</span>'}
    </div>
    <hr style="border-color:var(--border)">
    <div style="margin-top:16px">
      <button class="btn btn-accent" onclick="reviewVerification(${id},'approved')">Approve</button>
      <button class="btn btn-danger" onclick="reviewVerification(${id},'rejected')">Reject</button>
    </div>`;
  showModal('Verification Detail #'+id, body);
}

async function reviewVerification(id, status) {
  let rejectReason='';
  if(status==='rejected') {
    rejectReason=prompt('Reject reason:');
    if(rejectReason===null) return;
  }
  const r=await api('/admin/verification/review',{id,status,reject_reason:rejectReason});
  if(r.code===200){alert('[OK] Verification '+status);closeModal();pgVerification();}
  else alert('[ERROR] '+r.msg);
}

async function deleteVerification(id) {
  if(!confirm('Delete verification #'+id+'?'))return;
  const r=await api('/admin/verification/delete',{id});
  if(r.code===200){alert('[OK] Verification deleted');pgVerification();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  LOGIN LOG (登录日志)
// ================================================================
async function pgLoginLog(page=1) {
  _curPage='login-log';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const userId=document.getElementById('loginLogUserIdFilter')?.value||'';
    const status=document.getElementById('loginLogStatusFilter')?.value||'all';
    const r=await api('/admin/login-log/list',{page,size:20,user_id:userId||null,status:status==='all'?null:status});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(l=>{
      const statusBadge = l.status==='success'
        ? '<span style="color:var(--accent)">● Success</span>'
        : '<span style="color:var(--danger)">● '+H(l.status)+'</span>';
      return `<tr>
        <td>${l.id}</td>
        <td>${l.user_id||'-'}</td>
        <td>${H(l.username||'')}</td>
        <td>${H(l.ip||'')}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${H(l.user_agent||'')}">${H(l.user_agent||'')}</td>
        <td>${statusBadge}</td>
        <td>${T(l.login_time)}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteLoginLog(${l.id})">Delete</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>LOGIN LOG (登录日志)</h3>
          <div>
            <input type="text" class="form-input" style="width:100px;display:inline-block" placeholder="User ID" id="loginLogUserIdFilter">
            <select class="form-input" style="width:120px;display:inline-block" id="loginLogStatusFilter" onchange="pgLoginLog(1)">
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="pgLoginLog(1)">Filter</button>
            <button class="btn btn-warning btn-sm" onclick="cleanLoginLog()">Clean Old</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>ID</th><th>User ID</th><th>Username</th><th>IP</th><th>User Agent</th><th>Status</th><th>Time</th><th>Action</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="8" style="text-align:center;color:var(--text2)">No logs</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['login-log']=pgLoginLog;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function deleteLoginLog(id) {
  if(!confirm('Delete login log #'+id+'?'))return;
  const r=await api('/admin/login-log/delete',{id});
  if(r.code===200){alert('[OK] Log deleted');pgLoginLog();}
  else alert('[ERROR] '+r.msg);
}

async function cleanLoginLog() {
  if(!confirm('Clean login logs older than 30 days?'))return;
  const r=await api('/admin/login-log/clean',{days:30});
  if(r.code===200){alert('[OK] Old logs cleaned');pgLoginLog();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  CHECKIN (签到记录)
// ================================================================
async function pgCheckin(page=1) {
  _curPage='checkin';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const userId=document.getElementById('checkinUserIdFilter')?.value||'';
    const r=await api('/admin/checkin/list',{page,size:20,user_id:userId||null});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(c=>{
      return `<tr>
        <td>${c.id}</td>
        <td>${c.user_id||'-'}</td>
        <td>${H(c.username||'')}</td>
        <td>${H(c.checkin_date||'')}</td>
        <td>${N(c.reward_amount,2)} ${H(c.reward_coin||'USDT')}</td>
        <td>${T(c.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteCheckin(${c.id})">Delete</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>CHECKIN RECORDS (签到记录)</h3>
          <div>
            <input type="text" class="form-input" style="width:100px;display:inline-block" placeholder="User ID" id="checkinUserIdFilter">
            <button class="btn btn-primary btn-sm" onclick="pgCheckin(1)">Filter</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>ID</th><th>User ID</th><th>Username</th><th>Date</th><th>Reward</th><th>Time</th><th>Action</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="7" style="text-align:center;color:var(--text2)">No records</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['checkin']=pgCheckin;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function deleteCheckin(id) {
  if(!confirm('Delete checkin record #'+id+'?'))return;
  const r=await api('/admin/checkin/delete',{id});
  if(r.code===200){alert('[OK] Record deleted');pgCheckin();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  FINANCE - RECHARGE RECORDS (充币记录)
// ================================================================
async function pgFinanceRecharge(page=1) {
  _curPage='finance-recharge';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const userId=document.getElementById('finUserIdFilter')?.value||'';
    const status=document.getElementById('finStatusFilter')?.value||'all';
    const r=await api('/admin/finance/recharge/list',{page,size:20,user_id:userId||null,status});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(c=>{
      const statusBadge=c.status==='approved'?'<span style="color:var(--success)">● 已通过</span>':
                        c.status==='rejected'?'<span style="color:var(--danger)">● 已拒绝</span>':
                        '<span style="color:var(--warning)">● 待审核</span>';
      return `<tr>
        <td>${c.id}</td>
        <td>${H(c.user_identity||c.user_id||'-')}</td>
        <td>${H(c.username||'')}</td>
        <td>${H(c.real_name||'-')}</td>
        <td>${H(c.coin_symbol||'USDT')}</td>
        <td>${N(c.amount,2)}</td>
        <td>${H(c.account_type||'现货')}</td>
        <td>${H(c.address||'-')}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-accent" onclick="viewRecharge(${c.id})">查看</button>
          ${c.status==='pending'?`<button class="btn btn-sm btn-success" onclick="reviewRecharge(${c.id},'approved')">通过</button>
          <button class="btn btn-sm btn-danger" onclick="reviewRecharge(${c.id},'rejected')">拒绝</button>`:''}
          <button class="btn btn-sm btn-danger" onclick="deleteRecharge(${c.id})">删除</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>充币记录 (RECHARGE RECORDS)</h3>
          <div>
            <input type="text" class="form-input" style="width:100px;display:inline-block" placeholder="用户ID" id="finUserIdFilter">
            <select class="form-input" style="width:120px;display:inline-block" id="finStatusFilter" onchange="pgFinanceRecharge(1)">
              <option value="all">全部</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="pgFinanceRecharge(1)">筛选</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>ID</th><th>用户身份</th><th>用户名</th><th>姓名</th><th>硬币名称</th><th>数量</th><th>账户类型</th><th>地址</th><th>地位</th><th>行动</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="10" style="text-align:center;color:var(--text2)">无记录</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['finance-recharge']=pgFinanceRecharge;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function viewRecharge(id) {
  const r=await api('/admin/finance/recharge/detail',{id});
  if(r.code!==200){alert('[ERROR] '+r.msg);return;}
  const c=r.data;
  const body=`
    <div style="line-height:2">
      <b>ID:</b> ${c.id}<br>
      <b>User ID:</b> ${c.user_id}<br>
      <b>Username:</b> ${H(c.username||'')}<br>
      <b>Coin:</b> ${H(c.coin_symbol||'USDT')}<br>
      <b>Amount:</b> ${N(c.amount,2)}<br>
      <b>Network:</b> ${H(c.network||'-')}<br>
      <b>Address:</b> ${H(c.address||'-')}<br>
      <b>Tx Hash:</b> ${H(c.tx_hash||'-')}<br>
      <b>Status:</b> ${H(c.status)}<br>
      <b>Admin Remark:</b> ${H(c.admin_remark||'-')}<br>
      <b>Created At:</b> ${T(c.created_at)}<br>
      <b>Reviewed At:</b> ${T(c.reviewed_at)}<br>
    </div>`;
  showModal('Recharge Detail #'+id, body, '<button class="btn btn-accent" onclick="closeModal()">Close</button>');
}

async function reviewRecharge(id, status) {
  if(!confirm(status==='approved'?'Approve this recharge?':'Reject this recharge?'))return;
  const adminRemark=prompt('Admin remark (optional):')||'';
  const r=await api('/admin/finance/recharge/review',{id,status,admin_remark:adminRemark,reviewed_by:1});
  if(r.code===200){alert('[OK] Recharge '+status);pgFinanceRecharge();}
  else alert('[ERROR] '+r.msg);
}

async function deleteRecharge(id) {
  if(!confirm('Delete recharge record #'+id+'?'))return;
  const r=await api('/admin/finance/recharge/delete',{id});
  if(r.code===200){alert('[OK] Record deleted');pgFinanceRecharge();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  FINANCE - WITHDRAW REVIEW (提币审核)
// ================================================================
async function pgFinanceWithdraw(page=1) {
  _curPage='finance-withdraw';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const userId=document.getElementById('wdUserIdFilter')?.value||'';
    const status=document.getElementById('wdStatusFilter')?.value||'all';
    const r=await api('/admin/finance/withdraw/list',{page,size:20,user_id:userId||null,status});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(w=>{
      const statusBadge=w.status==='approved'?'<span style="color:var(--success)">● 已通过</span>':
                        w.status==='rejected'?'<span style="color:var(--danger)">● 已拒绝</span>':
                        '<span style="color:var(--warning)">● 待审核</span>';
      const actualAmount = (parseFloat(w.amount||0) - parseFloat(w.fee||0)).toFixed(2);
      return `<tr>
        <td>${w.id}</td>
        <td>${H(w.user_identity||w.user_id||'-')}</td>
        <td>${H(w.username||'')}</td>
        <td>${H(w.real_name||'-')}</td>
        <td>${H(w.coin_symbol||'USDT')}</td>
        <td>${H(w.address||'-')}</td>
        <td>${N(w.amount,2)}</td>
        <td>${actualAmount}</td>
        <td>${N(w.fee,2)}</td>
        <td>${T(w.created_at)}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-accent" onclick="viewWithdraw(${w.id})">查看</button>
          ${w.status==='pending'?`<button class="btn btn-sm btn-success" onclick="reviewWithdraw(${w.id},'approved')">通过</button>
          <button class="btn btn-sm btn-danger" onclick="reviewWithdraw(${w.id},'rejected')">拒绝</button>`:''}
          <button class="btn btn-sm btn-danger" onclick="deleteWithdraw(${w.id})">删除</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>提币审核 (WITHDRAW REVIEW)</h3>
          <div>
            <input type="text" class="form-input" style="width:100px;display:inline-block" placeholder="用户ID" id="wdUserIdFilter">
            <select class="form-input" style="width:120px;display:inline-block" id="wdStatusFilter" onchange="pgFinanceWithdraw(1)">
              <option value="all">全部</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="pgFinanceWithdraw(1)">筛选</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>ID</th><th>用户身份</th><th>用户名</th><th>姓名</th><th>硬币名称</th><th>地址</th><th>提币数量</th><th>实际到账数量</th><th>手续费</th><th>日期时间</th><th>地位</th><th>行动</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="12" style="text-align:center;color:var(--text2)">无记录</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['finance-withdraw']=pgFinanceWithdraw;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function viewWithdraw(id) {
  const r=await api('/admin/finance/withdraw/detail',{id});
  if(r.code!==200){alert('[ERROR] '+r.msg);return;}
  const w=r.data;
  const body=`
    <div style="line-height:2">
      <b>ID:</b> ${w.id}<br>
      <b>User ID:</b> ${w.user_id}<br>
      <b>Username:</b> ${H(w.username||'')}<br>
      <b>Coin:</b> ${H(w.coin_symbol||'USDT')}<br>
      <b>Amount:</b> ${N(w.amount,2)}<br>
      <b>Fee:</b> ${N(w.fee,2)}<br>
      <b>Address:</b> ${H(w.address||'-')}<br>
      <b>Status:</b> ${H(w.status)}<br>
      <b>Tx Hash:</b> ${H(w.tx_hash||'-')}<br>
      <b>Admin Remark:</b> ${H(w.admin_remark||'-')}<br>
      <b>Created At:</b> ${T(w.created_at)}<br>
      <b>Reviewed At:</b> ${T(w.reviewed_at)}<br>
    </div>`;
  showModal('Withdraw Detail #'+id, body, '<button class="btn btn-accent" onclick="closeModal()">Close</button>');
}

async function reviewWithdraw(id, status) {
  if(!confirm(status==='approved'?'Approve this withdraw?':'Reject this withdraw?'))return;
  const adminRemark=prompt('Admin remark (optional):')||'';
  const txHash=prompt('Tx Hash (required for approval):')||'';
  if(status==='approved' && !txHash){alert('Tx Hash required for approval');return;}
  const r=await api('/admin/finance/withdraw/review',{id,status,admin_remark:adminRemark,tx_hash:txHash,reviewed_by:1});
  if(r.code===200){alert('[OK] Withdraw '+status);pgFinanceWithdraw();}
  else alert('[ERROR] '+r.msg);
}

async function deleteWithdraw(id) {
  if(!confirm('Delete withdraw record #'+id+'?'))return;
  const r=await api('/admin/finance/withdraw/delete',{id});
  if(r.code===200){alert('[OK] Record deleted');pgFinanceWithdraw();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  FINANCE - TRANSFER RECORDS (划转记录)
// ================================================================
async function pgFinanceTransfer(page=1) {
  _curPage='finance-transfer';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const userId=document.getElementById('transferUserIdFilter')?.value||'';
    const r=await api('/admin/finance/transfer/list',{page,size:20,user_id:userId||null});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(t=>{
      const direction = `${H(t.from_coin||'')} → ${H(t.to_coin||'')}`;
      const statusBadge=t.status==='completed'?'<span style="color:var(--success)">● 已完成</span>':
                        '<span style="color:var(--warning)">● 处理中</span>';
      return `<tr>
        <td>${t.id}</td>
        <td>${H(t.user_identity||t.user_id||'-')}</td>
        <td>${H(t.username||'')}</td>
        <td>${H(t.from_coin||'')}</td>
        <td>${direction}</td>
        <td>${N(t.from_amount,2)}</td>
        <td>${T(t.created_at)}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-accent" onclick="viewTransfer(${t.id})">查看</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTransfer(${t.id})">删除</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>划转记录 (TRANSFER RECORDS)</h3>
          <div>
            <input type="text" class="form-input" style="width:100px;display:inline-block" placeholder="用户ID" id="transferUserIdFilter">
            <button class="btn btn-primary btn-sm" onclick="pgFinanceTransfer(1)">筛选</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>ID</th><th>用户身份</th><th>用户名</th><th>硬币名称</th><th>方向</th><th>数量</th><th>时间</th><th>地位</th><th>行动</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="9" style="text-align:center;color:var(--text2)">无记录</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['finance-transfer']=pgFinanceTransfer;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function viewTransfer(id) {
  const r=await api('/admin/finance/transfer/detail',{id});
  if(r.code!==200){alert('[ERROR] '+r.msg);return;}
  const t=r.data;
  const body=`
    <div style="line-height:2">
      <b>ID:</b> ${t.id}<br>
      <b>User ID:</b> ${t.user_id}<br>
      <b>Username:</b> ${H(t.username||'')}<br>
      <b>From Coin:</b> ${H(t.from_coin||'')}<br>
      <b>From Amount:</b> ${N(t.from_amount,2)}<br>
      <b>To Coin:</b> ${H(t.to_coin||'')}<br>
      <b>To Amount:</b> ${N(t.to_amount,2)}<br>
      <b>Fee:</b> ${N(t.fee,2)}<br>
      <b>Status:</b> ${H(t.status||'completed')}<br>
      <b>Created At:</b> ${T(t.created_at)}<br>
    </div>`;
  showModal('Transfer Detail #'+id, body, '<button class="btn btn-accent" onclick="closeModal()">Close</button>');
}

async function deleteTransfer(id) {
  if(!confirm('Delete transfer record #'+id+'?'))return;
  const r=await api('/admin/finance/transfer/delete',{id});
  if(r.code===200){alert('[OK] Record deleted');pgFinanceTransfer();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  FINANCE - ASSET FLOW (资产明细)
// ================================================================
async function pgFinanceFlow(page=1) {
  _curPage='finance-flow';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const userId=document.getElementById('flowUserIdFilter')?.value||'';
    const type=document.getElementById('flowTypeFilter')?.value||'all';
    const coin=document.getElementById('flowCoinFilter')?.value||'all';
    const r=await api('/admin/finance/flow/list',{page,size:20,user_id:userId||null,type:type==='all'?null:type,coin_symbol:coin==='all'?null:coin});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(f=>{
      return `<tr>
        <td>${f.id}</td>
        <td>${H(f.user_identity||f.user_id||'-')}</td>
        <td>${H(f.username||'')}</td>
        <td>${H(f.account_type||'现货')}</td>
        <td>${H(f.type||'')}</td>
        <td>${H(f.coin_symbol||'')}</td>
        <td>${N(f.amount,2)}</td>
        <td>${N(f.balance_before,2)}</td>
        <td>${N(f.balance_after,2)}</td>
        <td>${T(f.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteFlow(${f.id})">删除</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>资产明细 (ASSET FLOW)</h3>
          <div>
            <input type="text" class="form-input" style="width:100px;display:inline-block" placeholder="用户ID" id="flowUserIdFilter">
            <select class="form-input" style="width:100px;display:inline-block" id="flowTypeFilter" onchange="pgFinanceFlow(1)">
              <option value="all">全部类型</option>
              <option value="deposit">充值</option>
              <option value="withdraw">提现</option>
              <option value="transfer">划转</option>
              <option value="trade">交易</option>
              <option value="fee">手续费</option>
            </select>
            <input type="text" class="form-input" style="width:80px;display:inline-block" placeholder="币种" id="flowCoinFilter">
            <button class="btn btn-primary btn-sm" onclick="pgFinanceFlow(1)">筛选</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>ID</th><th>用户身份</th><th>用户名</th><th>账户类型</th><th>日志类型</th><th>硬币名称</th><th>数量</th><th>余额前</th><th>平衡后</th><th>创建于</th><th>行动</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="11" style="text-align:center;color:var(--text2)">无记录</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['finance-flow']=pgFinanceFlow;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function deleteFlow(id) {
  if(!confirm('Delete flow record #'+id+'?'))return;
  const r=await api('/admin/finance/flow/delete',{id});
  if(r.code===200){alert('[OK] Record deleted');pgFinanceFlow();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  FINANCE - USER ASSETS (用户资产)
// ================================================================
async function pgFinanceAssets(page=1) {
  _curPage='finance-assets';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const keyword=document.getElementById('assetKeywordFilter')?.value||'';
    const r=await api('/admin/finance/assets/list',{page,size:20,keyword:keyword||null});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const d=r.data;
    const rows=d.records.map(w=>{
      return `<tr>
        <td>${w.user_id||'-'}</td>
        <td>${H(w.username||'')}</td>
        <td>${H(w.coin_symbol||'')}</td>
        <td>${N(w.available,2)}</td>
        <td>${N(w.frozen,2)}</td>
        <td>
          <button class="btn btn-sm btn-accent" onclick="editAsset(${w.user_id},'${H(w.coin_symbol)}',${w.available},${w.frozen})">编辑</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>用户资产 (USER ASSETS)</h3>
          <div>
            <input type="text" class="form-input" style="width:120px;display:inline-block" placeholder="关键词" id="assetKeywordFilter">
            <button class="btn btn-primary btn-sm" onclick="pgFinanceAssets(1)">搜索</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>UID</th><th>用户名</th><th>硬币名称</th><th>可用余额</th><th>冻结平衡</th><th>行动</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="6" style="text-align:center;color:var(--text2)">无资产记录</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card-footer">${pag(d.current,d.pages)}</div>
      </div>`;
    _go['finance-assets']=pgFinanceAssets;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function editAsset(userId, coinSymbol, available, frozen) {
  const body=`
    <div style="line-height:2">
      <b>User ID:</b> ${userId}<br>
      <b>Coin:</b> ${coinSymbol}<br>
      <b>Available:</b> <input type="number" id="editAvailable" value="${available}" step="0.01" style="width:100px"><br>
      <b>Frozen:</b> <input type="number" id="editFrozen" value="${frozen}" step="0.01" style="width:100px"><br>
    </div>`;
  const footer=`<button class="btn btn-accent" onclick="saveAsset(${userId},'${coinSymbol}')">Save</button>
               <button class="btn" onclick="closeModal()">Cancel</button>`;
  showModal('Edit Asset', body, footer);
}

async function saveAsset(userId, coinSymbol) {
  const available=parseFloat(document.getElementById('editAvailable').value)||0;
  const frozen=parseFloat(document.getElementById('editFrozen').value)||0;
  const r=await api('/admin/finance/assets/update',{user_id:userId,coin_symbol:coinSymbol,available,frozen});
  if(r.code===200){alert('[OK] Asset updated');closeModal();pgFinanceAssets();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  FINANCE - COIN LIST (币种列表)
// ================================================================
async function pgFinanceCoin() {
  _curPage='finance-coin';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/finance/coin/list',{});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const coins=r.data?.coins||[];
    const rows=coins.map(c=>{
      const statusBadge=c.status===1?'<span style="color:var(--success)">● 启用</span>':'<span style="color:var(--danger)">● 禁用</span>';
      return `<tr>
        <td>${c.id}</td>
        <td>${H(c.symbol||c.base_name||'')}</td>
        <td>${N(c.withdraw_fee,4)}</td>
        <td>${N(c.min_withdraw,2)}</td>
        <td>${N(c.max_withdraw,2)}</td>
        <td>${T(c.publish_time)}</td>
        <td>${N(c.total_supply,0)}</td>
        <td>${N(c.circulating_supply,0)}</td>
        <td>${H(c.coin_content||'-')}</td>
        <td>${c.coin_icon?'<img src="${H(c.coin_icon)}" style="width:24px;height:24px">':'-'}</td>
        <td>${statusBadge}</td>
        <td>${T(c.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-accent" onclick="editCoin(${c.id})">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCoin(${c.id})">删除</button>
          <button class="btn btn-sm ${c.status===1?'btn-warning':'btn-success'}" onclick="toggleCoin(${c.id},${c.status===1?0:1})">${c.status===1?'禁用':'启用'}</button>
        </td>
      </tr>`;
    }).join('');
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>币种列表 (COIN LIST)</h3>
          <div>
            <button class="btn btn-success" onclick="createCoin()">+ 添加币种</button>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>硬币ID</th><th>硬币名称</th><th>提款手续费</th><th>最低取款额</th><th>最高取款额</th><th>发布时间</th><th>总发行量</th><th>总循环</th><th>硬币含量</th><th>硬币图标</th><th>地位</th><th>创建于</th><th>行动</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="13" style="text-align:center;color:var(--text2)">无币种记录</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    _go['finance-coin']=pgFinanceCoin;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}

async function createCoin() {
  const body=`
    <div style="line-height:2">
      <b>Symbol:</b> <input type="text" id="coinSymbol" placeholder="e.g. BTC/USDT" style="width:150px"><br>
      <b>Base Coin:</b> <input type="text" id="coinBase" placeholder="e.g. BTC" style="width:150px"><br>
      <b>Quote Coin:</b> <input type="text" id="coinQuote" placeholder="e.g. USDT" style="width:150px"><br>
      <b>Base Name:</b> <input type="text" id="coinBaseName" placeholder="e.g. Bitcoin" style="width:150px"><br>
      <b>Withdraw Fee:</b> <input type="number" id="coinWithdrawFee" value="0.0001" step="0.0001" style="width:150px"><br>
      <b>Min Withdraw:</b> <input type="number" id="coinMinWithdraw" value="0.001" step="0.001" style="width:150px"><br>
      <b>Max Withdraw:</b> <input type="number" id="coinMaxWithdraw" value="1000" step="1" style="width:150px"><br>
      <b>Total Supply:</b> <input type="number" id="coinTotalSupply" value="0" step="1" style="width:150px"><br>
      <b>Circulating Supply:</b> <input type="number" id="coinCirculatingSupply" value="0" step="1" style="width:150px"><br>
      <b>Coin Content:</b> <input type="text" id="coinContent" placeholder="Coin description" style="width:150px"><br>
      <b>Coin Icon URL:</b> <input type="text" id="coinIcon" placeholder="https://..." style="width:150px"><br>
    </div>`;
  const footer=`<button class="btn btn-accent" onclick="saveNewCoin()">Create</button>
               <button class="btn" onclick="closeModal()">Cancel</button>`;
  showModal('Create Coin', body, footer);
}

async function saveNewCoin() {
  const symbol=document.getElementById('coinSymbol').value.trim();
  const base_coin=document.getElementById('coinBase').value.trim();
  const quote_coin=document.getElementById('coinQuote').value.trim();
  const base_name=document.getElementById('coinBaseName').value.trim();
  const withdraw_fee=parseFloat(document.getElementById('coinWithdrawFee').value)||0;
  const min_withdraw=parseFloat(document.getElementById('coinMinWithdraw').value)||0;
  const max_withdraw=parseFloat(document.getElementById('coinMaxWithdraw').value)||0;
  const total_supply=parseFloat(document.getElementById('coinTotalSupply').value)||0;
  const circulating_supply=parseFloat(document.getElementById('coinCirculatingSupply').value)||0;
  const coin_content=document.getElementById('coinContent').value.trim();
  const coin_icon=document.getElementById('coinIcon').value.trim();
  if(!symbol||!base_coin||!quote_coin||!base_name){alert('Required fields missing');return;}
  const r=await api('/admin/finance/coin/create',{symbol,base_coin,quote_coin,base_name,withdraw_fee,min_withdraw,max_withdraw,total_supply,circulating_supply,coin_content,coin_icon});
  if(r.code===200){alert('[OK] Coin created');closeModal();pgFinanceCoin();}
  else alert('[ERROR] '+r.msg);
}

async function editCoin(id) {
  const r=await api('/admin/finance/coin/list',{});
  if(r.code!==200){alert('[ERROR] '+r.msg);return;}
  const coin=r.data.coins.find(c=>c.id===id);
  if(!coin){alert('Coin not found');return;}
  const body=`
    <div style="line-height:2">
      <b>Symbol:</b> <input type="text" id="editCoinSymbol" value="${H(coin.symbol||'')}" style="width:150px"><br>
      <b>Base Coin:</b> <input type="text" id="editCoinBase" value="${H(coin.base_coin||'')}" style="width:150px"><br>
      <b>Quote Coin:</b> <input type="text" id="editCoinQuote" value="${H(coin.quote_coin||'')}" style="width:150px"><br>
      <b>Base Name:</b> <input type="text" id="editCoinBaseName" value="${H(coin.base_name||'')}" style="width:150px"><br>
      <b>Withdraw Fee:</b> <input type="number" id="editCoinWithdrawFee" value="${coin.withdraw_fee||0}" step="0.0001" style="width:150px"><br>
      <b>Min Withdraw:</b> <input type="number" id="editCoinMinWithdraw" value="${coin.min_withdraw||0}" step="0.001" style="width:150px"><br>
      <b>Max Withdraw:</b> <input type="number" id="editCoinMaxWithdraw" value="${coin.max_withdraw||0}" step="1" style="width:150px"><br>
      <b>Total Supply:</b> <input type="number" id="editCoinTotalSupply" value="${coin.total_supply||0}" step="1" style="width:150px"><br>
      <b>Circulating Supply:</b> <input type="number" id="editCoinCirculatingSupply" value="${coin.circulating_supply||0}" step="1" style="width:150px"><br>
      <b>Coin Content:</b> <input type="text" id="editCoinContent" value="${H(coin.coin_content||'')}" style="width:150px"><br>
      <b>Coin Icon URL:</b> <input type="text" id="editCoinIcon" value="${H(coin.coin_icon||'')}" style="width:150px"><br>
      <b>Sort Order:</b> <input type="number" id="editCoinSort" value="${coin.sort_order||0}" style="width:100px"><br>
      <b>Status:</b> <select id="editCoinStatus">
        <option value="1" ${coin.status===1?'selected':''}>启用</option>
        <option value="0" ${coin.status===0?'selected':''}>禁用</option>
      </select><br>
    </div>`;
  const footer=`<button class="btn btn-accent" onclick="saveEditCoin(${id})">Save</button>
               <button class="btn" onclick="closeModal()">Cancel</button>`;
  showModal('Edit Coin #'+id, body, footer);
}

async function saveEditCoin(id) {
  const symbol=document.getElementById('editCoinSymbol').value.trim();
  const base_coin=document.getElementById('editCoinBase').value.trim();
  const quote_coin=document.getElementById('editCoinQuote').value.trim();
  const base_name=document.getElementById('editCoinBaseName').value.trim();
  const withdraw_fee=parseFloat(document.getElementById('editCoinWithdrawFee').value)||0;
  const min_withdraw=parseFloat(document.getElementById('editCoinMinWithdraw').value)||0;
  const max_withdraw=parseFloat(document.getElementById('editCoinMaxWithdraw').value)||0;
  const total_supply=parseFloat(document.getElementById('editCoinTotalSupply').value)||0;
  const circulating_supply=parseFloat(document.getElementById('editCoinCirculatingSupply').value)||0;
  const coin_content=document.getElementById('editCoinContent').value.trim();
  const coin_icon=document.getElementById('editCoinIcon').value.trim();
  const sort_order=parseInt(document.getElementById('editCoinSort').value)||0;
  const status=parseInt(document.getElementById('editCoinStatus').value)||0;
  const r=await api('/admin/finance/coin/update',{id,symbol,base_coin,quote_coin,base_name,withdraw_fee,min_withdraw,max_withdraw,total_supply,circulating_supply,coin_content,coin_icon,sort_order,status});
  if(r.code===200){alert('[OK] Coin updated');closeModal();pgFinanceCoin();}
  else alert('[ERROR] '+r.msg);
}

async function deleteCoin(id) {
  if(!confirm('Delete coin #'+id+'?'))return;
  const r=await api('/admin/finance/coin/delete',{id});
  if(r.code===200){alert('[OK] Coin deleted');pgFinanceCoin();}
  else alert('[ERROR] '+r.msg);
}

async function toggleCoin(id, status) {
  const r=await api('/admin/finance/coin/toggle',{id,status});
  if(r.code===200){alert('[OK] Status updated');pgFinanceCoin();}
  else alert('[ERROR] '+r.msg);
}

// ================================================================
//  RISK CONTROL - 风控管理（新增）
// ================================================================

// ===== 行情控制 =====
async function pgMarketControl() {
  _curPage='market-control';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="card"><div class="card-header"><h3>📊 MARKET CONTROL - 行情控制</h3><button class="btn btn-sm btn-accent" onclick="pgMarketControl()">REFRESH</button></div><div class="card-body">Loading...</div></div>';
  
  try {
    const r=await api('/admin/market-control/list',{});
    const rules=r.data||[];
    
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>📊 MARKET CONTROL - 行情控制</h3>
          <button class="btn btn-sm btn-accent" onclick="pgMarketControl()">REFRESH</button>
        </div>
        <div class="card-body">
          <h4 style="font-size:12px;margin-bottom:10px">ADD MARKET CONTROL RULE</h4>
          <div style="display:grid;grid-template-columns:120px 100px 100px 100px 1fr;gap:8px;margin-bottom:12px;align-items:end">
            <div><label style="font-size:10px;color:var(--text2)">Symbol</label><input class="form-control" id="mcSymbol" placeholder="BTCUSDT" style="margin-top:4px;font-size:12px"></div>
            <div><label style="font-size:10px;color:var(--text2)">Max Price</label><input class="form-control" id="mcMaxPrice" type="number" placeholder="100000" style="margin-top:4px;font-size:12px"></div>
            <div><label style="font-size:10px;color:var(--text2)">Min Price</label><input class="form-control" id="mcMinPrice" type="number" placeholder="80000" style="margin-top:4px;font-size:12px"></div>
            <div><label style="font-size:10px;color:var(--text2)">Action</label><select class="form-control" id="mcAction" style="margin-top:4px;font-size:12px"><option value="block">Block Trading</option><option value="alert">Alert Only</option><option value="limit">Limit Order</option></select></div>
            <div><button class="btn btn-accent" onclick="addMarketControl()" style="font-size:12px">ADD RULE</button></div>
          </div>
          <div id="mcMsg" style="margin-bottom:12px"></div>
          ${rules.length?'<table><thead><tr><th>ID</th><th>Symbol</th><th>Max Price</th><th>Min Price</th><th>Action</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>'+rules.map(r=>'<tr><td>'+r.id+'</td><td><b>'+H(r.symbol)+'</b></td><td>'+(r.max_price||'-')+'</td><td>'+(r.min_price||'-')+'</td><td>'+H(r.action)+'</td><td>'+(r.enabled?'<span class="badge badge-green">ON</span>':'<span class="badge badge-red">OFF</span>')+'</td><td style="font-size:11px">'+r.created_at+'</td><td><button class="btn btn-sm" onclick="toggleMarketControl('+r.id+','+r.enabled+')">'+(r.enabled?'OFF':'ON')+'</button> <button class="btn btn-sm btn-danger" onclick="delMarketControl('+r.id+')">DEL</button></td></tr>').join('')+'</tbody></table>':'<p style="color:var(--text2);font-size:12px">No market control rules</p>'}
        </div>
      </div>`;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR loading market control ]</div>';
  }
}

async function addMarketControl(){
  const symbol=document.getElementById('mcSymbol').value.trim().toUpperCase();
  const maxPrice=parseFloat(document.getElementById('mcMaxPrice').value)||0;
  const minPrice=parseFloat(document.getElementById('mcMinPrice').value)||0;
  const action=document.getElementById('mcAction').value;
  if(!symbol){document.getElementById('mcMsg').innerHTML='<span style="color:var(--danger)">Symbol required</span>';return;}
  const r=await api('/admin/market-control/add',{symbol,maxPrice,minPrice,action});
  document.getElementById('mcMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">✅ Added</span>':'<span style="color:var(--danger)">❌ '+H(r.msg)+'</span>';
  if(r.code===200) setTimeout(pgMarketControl,500);
}

async function toggleMarketControl(id,cur){
  const r=await api('/admin/market-control/toggle',{id,enabled:!cur});
  if(r.code===200) pgMarketControl();
}

async function delMarketControl(id){
  if(!confirm('Delete rule #'+id+'?'))return;
  const r=await api('/admin/market-control/delete',{id});
  if(r.code===200) pgMarketControl();
}

// ===== 合约风控 =====
async function pgContractRisk() {
  _curPage='contract-risk';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="card"><div class="card-header"><h3>⚠️ CONTRACT RISK - 合约风控</h3><button class="btn btn-sm btn-accent" onclick="pgContractRisk()">REFRESH</button></div><div class="card-body">Loading...</div></div>';
  
  try {
    const r=await api('/admin/contract-risk/list',{});
    const rules=r.data||[];
    
    el.innerHTML=`
      <div class="card">
        <div class="card-header">
          <h3>⚠️ CONTRACT RISK - 合约风控</h3>
          <button class="btn btn-sm btn-accent" onclick="pgContractRisk()">REFRESH</button>
        </div>
        <div class="card-body">
          <h4 style="font-size:12px;margin-bottom:10px">ADD CONTRACT RISK RULE</h4>
          <div style="display:grid;grid-template-columns:120px 100px 100px 100px 1fr;gap:8px;margin-bottom:12px;align-items:end">
            <div><label style="font-size:10px;color:var(--text2)">Symbol</label><input class="form-control" id="crSymbol" placeholder="BTCUSDT" style="margin-top:4px;font-size:12px"></div>
            <div><label style="font-size:10px;color:var(--text2)">Max Leverage</label><input class="form-control" id="crMaxLev" type="number" placeholder="10" style="margin-top:4px;font-size:12px"></div>
            <div><label style="font-size:10px;color:var(--text2)">Max Position</label><input class="form-control" id="crMaxPos" type="number" placeholder="100000" style="margin-top:4px;font-size:12px"></div>
            <div><label style="font-size:10px;color:var(--text2)">Risk Level</label><select class="form-control" id="crRiskLevel" style="margin-top:4px;font-size:12px"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div><button class="btn btn-accent" onclick="addContractRisk()" style="font-size:12px">ADD RULE</button></div>
          </div>
          <div id="crMsg" style="margin-bottom:12px"></div>
          ${rules.length?'<table><thead><tr><th>ID</th><th>Symbol</th><th>Max Lev</th><th>Max Pos</th><th>Risk</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>'+rules.map(r=>'<tr><td>'+r.id+'</td><td><b>'+H(r.symbol)+'</b></td><td>'+r.max_leverage+'x</td><td>'+r.max_position+'</td><td><span style="color:'+(r.risk_level==='high'?'var(--danger)':r.risk_level==='medium'?'var(--warning)':'var(--accent)')+'">'+r.risk_level.toUpperCase()+'</span></td><td>'+(r.enabled?'<span class="badge badge-green">ON</span>':'<span class="badge badge-red">OFF</span>')+'</td><td style="font-size:11px">'+r.created_at+'</td><td><button class="btn btn-sm" onclick="toggleContractRisk('+r.id+','+r.enabled+')">'+(r.enabled?'OFF':'ON')+'</button> <button class="btn btn-sm btn-danger" onclick="delContractRisk('+r.id+')">DEL</button></td></tr>').join('')+'</tbody></table>':'<p style="color:var(--text2);font-size:12px">No contract risk rules</p>'}
        </div>
      </div>`;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">[ ERROR loading contract risk ]</div>';
  }
}

async function addContractRisk(){
  const symbol=document.getElementById('crSymbol').value.trim().toUpperCase();
  const maxLev=parseInt(document.getElementById('crMaxLev').value)||0;
  const maxPos=parseFloat(document.getElementById('crMaxPos').value)||0;
  const riskLevel=document.getElementById('crRiskLevel').value;
  if(!symbol){document.getElementById('crMsg').innerHTML='<span style="color:var(--danger)">Symbol required</span>';return;}
  const r=await api('/admin/contract-risk/add',{symbol,maxLeverage:maxLev,maxPosition:maxPos,riskLevel});
  document.getElementById('crMsg').innerHTML=r.code===200?'<span style="color:var(--accent)">✅ Added</span>':'<span style="color:var(--danger)">❌ '+H(r.msg)+'</span>';
  if(r.code===200) setTimeout(pgContractRisk,500);
}

async function toggleContractRisk(id,cur){
  const r=await api('/admin/contract-risk/toggle',{id,enabled:!cur});
  if(r.code===200) pgContractRisk();
}

async function delContractRisk(id){
  if(!confirm('Delete rule #'+id+'?'))return;
  const r=await api('/admin/contract-risk/delete',{id});
  if(r.code===200) pgContractRisk();
}

// ===== AUTO-LOGIN (runs after all functions above are defined) =====
(function(){
  const token = localStorage.getItem('admin_token');
  if (!token) return;
  fetch(API_BASE + '/admin/health', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.ok ? showAdmin() : localStorage.removeItem('admin_token'))
    .catch(() => localStorage.removeItem('admin_token'));
})();
// ========== 客服管理（函数已移动到 cs-functions.js）==========
// 
// 以下函数已移动到 cs-functions.js，这里只保留路由映射
// 'cs-config': pgCsConfig     <- 在 cs-functions.js 中定义
// 'cs-messages': pgCsMessages <- 在 cs-functions.js 中定义
//
// 确保 index.html 中先加载 cs-functions.js，再加载 admin-app.js
// 或者更好的做法：从 admin-app.js 的路由表中删除 cs-config 和 cs-messages，
// 让 cs-functions.js 中的函数直接被全局访问




// ========== 客服管理（修复版）==========

function pgCsConfig() {
  const el = document.getElementById('contentArea');
  el.innerHTML = '<div class="card"><div class="card-header"><h3>📞 CUSTOMER SERVICE CONFIG</h3></div><div class="card-body">Loading...</div></div>';
  
  fetch('/admin/cs/config', {
    headers: {'Authorization': 'Bearer ' + localStorage.getItem('admin_token')}
  })
  .then(r => r.json())
  .then(res => {
    const cs = res.data || {};
    let html = '<div class="card">';
    html += '<div class="card-header"><h3>📞 CUSTOMER SERVICE CONFIG</h3><button class="btn btn-sm btn-accent" onclick="pgCsConfig()">REFRESH</button></div>';
    html += '<div class="card-body">';
    html += '<div class="form-group"><label>Customer Service Name</label><input type="text" id="cs-name" value="' + (cs.name || 'Customer Service') + '" class="form-control"></div>';
    html += '<div class="form-group"><label>Avatar URL</label><input type="text" id="cs-avatar" value="' + (cs.avatar || '') + '" class="form-control"></div>';
    html += '<div class="form-group"><label>Welcome Message</label><textarea id="cs-welcome" class="form-control" rows="3">' + (cs.welcome_message || 'Hello, how can I help you?') + '</textarea></div>';
    html += '<div class="form-group"><label>Status</label><select id="cs-enabled" class="form-control"><option value="1"' + (cs.enabled == 1 ? ' selected' : '') + '>Enabled</option><option value="0"' + (cs.enabled == 0 ? ' selected' : '') + '>Disabled</option></select></div>';
    html += '<button class="btn btn-accent" onclick="saveCsConfig()">SAVE CONFIG</button>';
    html += '</div></div>';
    el.innerHTML = html;
  });
}

function pgCsMessages() {
    const status = document.getElementById('cs-status-filter') ? document.getElementById('cs-status-filter').value : '';
    const el = document.getElementById('contentArea');
    el.innerHTML = '<div class="card"><div class="card-header"><h3>💬 CUSTOMER SERVICE MESSAGES</h3></div><div class="card-body">Loading...</div></div>';
    
    fetch('/admin/cs/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        },
        body: JSON.stringify({page:1, size:50, status:status})
    })
    .then(r => r.json())
    .then(res => {
        const data = res.data || {};
        const list = data.list || [];
        let html = '<div class="card"><div class="card-header"><h3>💬 CUSTOMER SERVICE MESSAGES</h3><div><select id="cs-status-filter" onchange="pgCsMessages()" style="margin-right:10px"><option value="">All</option><option value="pending">Pending</option><option value="replied">Replied</option></select><button class="btn btn-sm btn-accent" onclick="pgCsMessages()">REFRESH</button></div></div><div class="card-body"><table class="table"><thead><tr><th>ID</th><th>User</th><th>Message</th><th>Reply</th><th>Status</th><th>Time</th><th>Action</th></tr></thead><tbody>';
        list.forEach(msg => {
            html += '<tr><td>' + msg.id + '</td><td>' + (msg.username || 'User#' + msg.user_id) + '</td><td style="max-width:300px;word-break:break-word">' + msg.message + '</td><td style="max-width:300px;word-break:break-word">' + (msg.reply || '-') + '</td><td><span class="badge badge-' + (msg.status === 'replied' ? 'success' : 'warning') + '">' + msg.status + '</span></td><td>' + (msg.created_at || '') + '</td><td>';
            if (msg.status !== 'replied') html += '<button class="btn btn-sm btn-accent" onclick="replyCsMsg(' + msg.id + ')">REPLY</button> ';
            html += '<button class="btn btn-sm btn-danger" onclick="deleteCsMsg(' + msg.id + ')">DELETE</button></td></tr>';
        });
        html += '</tbody></table></div></div>';
        el.innerHTML = html;
    });
}


function saveCsConfig() {
    const name = document.getElementById('cs-name').value;
    const avatar = document.getElementById('cs-avatar').value;
    const welcome_message = document.getElementById('cs-welcome').value;
    const enabled = document.getElementById('cs-enabled').value == '1';
    
    fetch('/admin/cs/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        },
        body: JSON.stringify({name:name, avatar:avatar, welcome_message:welcome_message, enabled:enabled})
    })
    .then(r => r.json())
    .then(res => {
        if(res.code===200) {
            alert('✅ Customer service config updated!');
            pgCsConfig();
        } else {
            alert('❌ ' + res.msg);
        }
    });
}

function replyCsMsg(id) {
    const reply = prompt('Enter reply message:');
    if(!reply) return;
    
    fetch('/admin/cs/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        },
        body: JSON.stringify({id:id, reply:reply})
    })
    .then(r => r.json())
    .then(res => {
        if(res.code===200) {
            alert('✅ Reply sent!');
            pgCsMessages();
        } else {
            alert('❌ ' + res.msg);
        }
    });
}

function deleteCsMsg(id) {
    if(!confirm('Delete this message?')) return;

    fetch('/admin/cs/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        },
        body: JSON.stringify({id:id})
    })
    .then(r => r.json())
    .then(res => {
        if(res.code===200) {
            alert('✅ Message deleted!');
            pgCsMessages();
        } else {
            alert('❌ ' + res.msg);
        }
    });
}

// ===== Toast Notification Function =====
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    // Set background color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    toast.style.backgroundColor = colors[type] || colors.info;

    // Add icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    toast.textContent = (icons[type] || '') + ' ' + message;

    // Add to page
    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Add CSS animations for toast
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

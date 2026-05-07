// ===== KLAKNA ADMIN PANEL APP v4 () =====

const NAV_ITEMS = [
  {key:'dashboard', icon:'[D]', text:'DASHBOARD'},
  {key:'users',     icon:'[U]', text:'USERS'},
  {key:'orders',    icon:'[O]', text:'ORDERS'},
  {key:'positions', icon:'[P]', text:'POSITIONS'},
  {key:'flows',     icon:'[F]', text:'FLOWS'},
  {key:'coins',     icon:'[C]', text:'COINS'},
  {key:'market',    icon:'[M]', text:'MARKET'},
  {key:'inject',    icon:'[I]', text:'INJECT'},
  {key:'restrict',  icon:'[R]', text:'RESTRICT'},
  {key:'command',   icon:'[C]', text:'COMMAND'},
  {key:'controls',  icon:'[T]', text:'CONTROLS'},
  {key:'logs',      icon:'[L]', text:'LOGS'},
  {key:'sql',       icon:'[S]', text:'SQL'},
  {key:'config',    icon:'[K]', text:'CONFIG'},
  {key:'danger',    icon:'[!]', text:'DANGER ZONE'},
];

function showAdmin() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminView').style.display = 'flex';
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = NAV_ITEMS.map((n,i) =>
    `<div class="nav-item${i===0?' active':''}" data-page="${n.key}" onclick="navigateTo('${n.key}',this)">
      <span class="nav-icon">${n.icon}</span><span class="nav-text">${n.text}</span>
    </div>`
  ).join('');
  navigateTo('dashboard', nav.querySelector('.nav-item'));
}

function navigateTo(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  const m = NAV_ITEMS.find(n => n.key === page) || NAV_ITEMS[0];
  document.getElementById('pageIcon').textContent = m.icon;
  document.getElementById('pageTitle').textContent = m.text;
  const area = document.getElementById('contentArea');
  area.scrollTop = 0;
  renderers[page] ? renderers[page]() : (area.innerHTML = '<div class="empty">[ NOT FOUND ]</div>');
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
const renderers = { dashboard:pgDashboard, users:pgUsers, orders:pgOrders, positions:pgPositions, flows:pgFlows, coins:pgCoins, market:pgMarket, inject:pgInject, restrict:pgRestrict, command:pgCommand, controls:pgControls, logs:pgLogs, sql:pgSql, config:pgConfig, danger:pgDanger };
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
  const el=document.getElementById('pageContent');
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
  const el=document.getElementById('pageContent');
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
  const el=document.getElementById('pageContent');
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
  const el=document.getElementById('pageContent');
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

// ===== AUTO-LOGIN (runs after all functions above are defined) =====
(function(){
  const token = localStorage.getItem('admin_token');
  if (!token) return;
  fetch(API_BASE + '/admin/health', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.ok ? showAdmin() : localStorage.removeItem('admin_token'))
    .catch(() => localStorage.removeItem('admin_token'));
})();

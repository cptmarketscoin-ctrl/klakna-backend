// ========== 客服管理（新增）==========

// 客服配置页面
function pgCsConfig() {
  const el = document.getElementById('contentArea');
  el.innerHTML='<div class="card"><div class="card-header"><h3>📞 CUSTOMER SERVICE CONFIG</h3></div><div class="card-body">Loading...</div></div>';
    
    fetch('/admin/cs/config', {
        headers: {'Authorization': 'Bearer '+localStorage.getItem('admintoken')}
    })
    .then(r=>r.json())
    .then(res=>{
        const cs = res.data || {};
        el.innerHTML=`
        <div class="card">
            <div class="card-header"><h3>📞 CUSTOMER SERVICE CONFIG</h3><button class="btn btn-sm btn-accent" onclick="pgCsConfig()">REFRESH</button></div>
            <div class="card-body">
                <div class="form-group">
                    <label>Customer Service Name</label>
                    <input type="text" id="cs-name" value="${cs.name||'Customer Service'}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Avatar URL</label>
                    <input type="text" id="cs-avatar" value="${cs.avatar||''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Welcome Message</label>
                    <textarea id="cs-welcome" class="form-control" rows="3">${cs.welcome_message||'Hello, how can I help you?'}</textarea>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="cs-enabled" class="form-control">
                        <option value="1" ${cs.enabled==1?'selected':''}>Enabled</option>
                        <option value="0" ${cs.enabled==0?'selected':''}>Disabled</option>
                    </select>
                </div>
                <button class="btn btn-accent" onclick="saveCsConfig()">SAVE CONFIG</button>
            </div>
        </div>`;
    });
}

// 保存客服配置
function saveCsConfig() {
    const name = document.getElementById('cs-name').value;
    const avatar = document.getElementById('cs-avatar').value;
    const welcome_message = document.getElementById('cs-welcome').value;
    const enabled = document.getElementById('cs-enabled').value == '1';
    
    fetch('/admin/cs/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer '+localStorage.getItem('admintoken')
        },
        body: JSON.stringify({name, avatar, welcome_message, enabled})
    })
    .then(r=>r.json())
    .then(res=>{
        if(res.code===200) {
            showToast('✅ Customer service config updated!', 'success');
            pgCsConfig();
        } else {
            showToast('❌ '+res.msg, 'error');
        }
    });
}

// 客服消息页面
function pgCsMessages() {
    const status = document.getElementById('cs-status-filter') ? document.getElementById('cs-status-filter').value : '';
    const el = document.getElementById('contentArea');
    el.innerHTML='<div class="card"><div class="card-header"><h3>💬 CUSTOMER SERVICE MESSAGES</h3></div><div class="card-body">Loading...</div></div>';
    
    fetch('/admin/cs/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer '+localStorage.getItem('admintoken')
        },
        body: JSON.stringify({page:1, size:50, status})
    })
    .then(r=>r.json())
    .then(res=>{
        const data = res.data || {};
        const list = data.list || [];
        let html = `
        <div class="card">
            <div class="card-header">
                <h3>💬 CUSTOMER SERVICE MESSAGES</h3>
                <div>
                    <select id="cs-status-filter" onchange="pgCsMessages()" style="margin-right:10px">
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="replied">Replied</option>
                    </select>
                    <button class="btn btn-sm btn-accent" onclick="pgCsMessages()">REFRESH</button>
                </div>
            </div>
            <div class="card-body">
                <table class="table">
                    <thead><tr><th>ID</th><th>User</th><th>Message</th><th>Reply</th><th>Status</th><th>Time</th><th>Action</th></tr></thead>
                    <tbody>`;
        
        list.forEach(msg=>{
            html += `<tr>
                <td>${msg.id}</td>
                <td>${msg.username||'User#'+msg.user_id}</td>
                <td style="max-width:300px;word-break:break-word">${msg.message}</td>
                <td style="max-width:300px;word-break:break-word">${msg.reply||'-'}</td>
                <td><span class="badge badge-${msg.status==='replied'?'success':'warning'}">${msg.status}</span></td>
                <td>${msg.created_at||''}</td>
                <td>
                    ${msg.status!=='replied'?`<button class="btn btn-sm btn-accent" onclick="replyCsMsg(${msg.id})">REPLY</button> `:''}
                    <button class="btn btn-sm btn-danger" onclick="deleteCsMsg(${msg.id})">DELETE</button>
                </td>
            </tr>`;
        });
        
        html += `</tbody></table></div></div>`;
        el.innerHTML = html;
    });
}

// 回复客服消息
function replyCsMsg(id) {
    const reply = prompt('Enter reply message:');
    if(!reply) return;
    
    fetch('/admin/cs/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer '+localStorage.getItem('admintoken')
        },
        body: JSON.stringify({id, reply})
    })
    .then(r=>r.json())
    .then(res=>{
        if(res.code===200) {
            showToast('✅ Reply sent!', 'success');
            pgCsMessages();
        } else {
            showToast('❌ '+res.msg, 'error');
        }
    });
}

// 删除客服消息
function deleteCsMsg(id) {
    if(!confirm('Delete this message?')) return;
    
    fetch('/admin/cs/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer '+localStorage.getItem('admintoken')
        },
        body: JSON.stringify({id})
    })
    .then(r=>r.json())
    .then(res=>{
        if(res.code===200) {
            showToast('✅ Message deleted!', 'success');
            pgCsMessages();
        } else {
            showToast('❌ '+res.msg, 'error');
        }
    });
}

/**
 * 种子数据 — 币种对、角色、权限、菜单
 * 启动时检查是否已有数据，没有则插入
 */
const { getDb, saveDb } = require('./index');

async function seed() {
  const db = await getDb();

  // ========== 币种种子 ==========
  const existing = db.exec("SELECT COUNT(*) FROM coin_pairs");
  if (!existing[0] || existing[0].values[0][0] === 0) {
    console.log('[Seed] 插入币种种子数据...');
    const coins = [
      { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', name: 'Bitcoin', sort: 999, icon: 'icon-btc' },
      { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', name: 'Ethereum', sort: 998, icon: 'icon-eth' },
      { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', name: 'BNB', sort: 997, icon: 'icon-bnb' },
      { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', name: 'Solana', sort: 996, icon: 'icon-sol' },
      { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', name: 'XRP', sort: 995, icon: 'icon-xrp' },
      { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', name: 'Dogecoin', sort: 994, icon: 'icon-doge' },
      { symbol: 'ADAUSDT', base: 'ADA', quote: 'USDT', name: 'Cardano', sort: 993, icon: 'icon-ada' },
      { symbol: 'DOTUSDT', base: 'DOT', quote: 'USDT', name: 'Polkadot', sort: 992, icon: 'icon-dot' },
      { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', name: 'Avalanche', sort: 991, icon: 'icon-avax' },
      { symbol: 'MATICUSDT', base: 'MATIC', quote: 'USDT', name: 'Polygon', sort: 990, icon: 'icon-matic' },
      { symbol: 'LINKUSDT', base: 'LINK', quote: 'USDT', name: 'Chainlink', sort: 989, icon: 'icon-link' },
      { symbol: 'UNIUSDT', base: 'UNI', quote: 'USDT', name: 'Uniswap', sort: 988, icon: 'icon-uni' },
    ];
    const stmt = db.prepare("INSERT INTO coin_pairs (symbol, base_coin, quote_coin, base_name, sort_order, icon) VALUES (?, ?, ?, ?, ?, ?)");
    for (const c of coins) {
      stmt.run([c.symbol, c.base, c.quote, c.name, c.sort, c.icon]);
    }
    stmt.free();
    saveDb();
    console.log(`[Seed] 已插入 ${coins.length} 个币种对`);
  }

  // ========== 角色种子 ==========
  const roleCount = db.exec("SELECT COUNT(*) FROM roles");
  if (!roleCount[0] || roleCount[0].values[0][0] === 0) {
    console.log('[Seed] 插入角色种子数据...');
    db.run("INSERT INTO roles (name, description) VALUES ('super_admin', '超级管理员')");
    db.run("INSERT INTO roles (name, description) VALUES ('admin', '管理员')");
    db.run("INSERT INTO roles (name, description) VALUES ('user', '普通用户')");
    saveDb();
    console.log('[Seed] 已插入 3 个角色');
  }

  // ========== 权限种子 ==========
  const permCount = db.exec("SELECT COUNT(*) FROM permissions");
  if (!permCount[0] || permCount[0].values[0][0] === 0) {
    console.log('[Seed] 插入权限种子数据...');
    const perms = [
      // 用户管理
      { code: 'user:create', name: '创建用户', desc: '允许创建新用户' },
      { code: 'user:read', name: '查看用户', desc: '允许查看用户列表和详情' },
      { code: 'user:update', name: '更新用户', desc: '允许修改用户信息' },
      { code: 'user:delete', name: '删除用户', desc: '允许删除用户' },
      // 角色管理
      { code: 'role:create', name: '创建角色', desc: '允许创建新角色' },
      { code: 'role:read', name: '查看角色', desc: '允许查看角色列表和权限' },
      { code: 'role:update', name: '更新角色', desc: '允许修改角色信息和权限' },
      { code: 'role:delete', name: '删除角色', desc: '允许删除角色' },
      // 权限管理
      { code: 'permission:read', name: '查看权限', desc: '允许查看权限列表' },
      // 菜单管理
      { code: 'menu:create', name: '创建菜单', desc: '允许创建新菜单项' },
      { code: 'menu:read', name: '查看菜单', desc: '允许查看菜单结构' },
      { code: 'menu:update', name: '更新菜单', desc: '允许修改菜单项' },
      { code: 'menu:delete', name: '删除菜单', desc: '允许删除菜单项' },
      // 订单管理
      { code: 'order:read', name: '查看订单', desc: '允许查看订单列表' },
      { code: 'order:update', name: '更新订单', desc: '允许修改订单状态' },
      { code: 'order:delete', name: '删除订单', desc: '允许删除订单' },
      // 仓位管理
      { code: 'position:read', name: '查看仓位', desc: '允许查看仓位列表' },
      { code: 'position:update', name: '更新仓位', desc: '允许强制平仓等操作' },
      { code: 'position:delete', name: '删除仓位', desc: '允许删除仓位记录' },
      // 流水管理
      { code: 'flow:read', name: '查看流水', desc: '允许查看资金流水' },
      // 币种管理
      { code: 'coin:create', name: '创建币种', desc: '允许添加新币种' },
      { code: 'coin:read', name: '查看币种', desc: '允许查看币种列表' },
      { code: 'coin:update', name: '更新币种', desc: '允许修改币种信息' },
      { code: 'coin:delete', name: '删除币种', desc: '允许删除币种' },
      // 市场管理
      { code: 'market:read', name: '查看市场数据', desc: '允许查看市场行情' },
      { code: 'market:update', name: '更新市场数据', desc: '允许修改市场数据' },
      // 注入管理
      { code: 'inject:create', name: '创建注入', desc: '允许创建前端注入规则' },
      { code: 'inject:read', name: '查看注入', desc: '允许查看注入规则' },
      { code: 'inject:update', name: '更新注入', desc: '允许修改注入规则' },
      { code: 'inject:delete', name: '删除注入', desc: '允许删除注入规则' },
      // 限制管理
      { code: 'restrict:create', name: '创建限制', desc: '允许创建用户限制' },
      { code: 'restrict:read', name: '查看限制', desc: '允许查看用户限制' },
      { code: 'restrict:update', name: '更新限制', desc: '允许修改用户限制' },
      { code: 'restrict:delete', name: '删除限制', desc: '允许删除用户限制' },
      // 命令管理
      { code: 'command:create', name: '创建命令', desc: '允许创建控制命令' },
      { code: 'command:read', name: '查看命令', desc: '允许查看控制命令' },
      { code: 'command:update', name: '更新命令', desc: '允许修改控制命令' },
      { code: 'command:delete', name: '删除命令', desc: '允许删除控制命令' },
      // 日志管理
      { code: 'log:read', name: '查看日志', desc: '允许查看操作日志' },
      { code: 'log:delete', name: '删除日志', desc: '允许删除操作日志' },
      // 系统配置
      { code: 'config:read', name: '查看配置', desc: '允许查看系统配置' },
      { code: 'config:update', name: '更新配置', desc: '允许修改系统配置' },
      // SQL 执行
      { code: 'sql:execute', name: '执行SQL', desc: '允许执行SQL语句' },
    ];
    const stmt = db.prepare("INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)");
    for (const p of perms) {
      stmt.run([p.code, p.name, p.desc]);
    }
    stmt.free();
    saveDb();
    console.log(`[Seed] 已插入 ${perms.length} 个权限`);
  }

  // ========== 菜单种子 ==========
  const menuCount = db.exec("SELECT COUNT(*) FROM menus");
  if (!menuCount[0] || menuCount[0].values[0][0] === 0) {
    console.log('[Seed] 插入菜单种子数据...');
    const menus = [
      { name: '仪表盘', icon: '[D]', path: '/admin/dashboard', component: 'Dashboard', parent: 0, sort: 1 },
      { name: '用户管理', icon: '[U]', path: '/admin/users', component: 'Users', parent: 0, sort: 2 },
      { name: '角色管理', icon: '[R]', path: '/admin/roles', component: 'Roles', parent: 0, sort: 3 },
      { name: '权限管理', icon: '[P]', path: '/admin/permissions', component: 'Permissions', parent: 0, sort: 4 },
      { name: '菜单管理', icon: '[M]', path: '/admin/menus', component: 'Menus', parent: 0, sort: 5 },
      { name: '订单管理', icon: '[O]', path: '/admin/orders', component: 'Orders', parent: 0, sort: 6 },
      { name: '仓位管理', icon: '[P]', path: '/admin/positions', component: 'Positions', parent: 0, sort: 7 },
      { name: '流水管理', icon: '[F]', path: '/admin/flows', component: 'Flows', parent: 0, sort: 8 },
      { name: '币种管理', icon: '[C]', path: '/admin/coins', component: 'Coins', parent: 0, sort: 9 },
      { name: '市场管理', icon: '[M]', path: '/admin/market', component: 'Market', parent: 0, sort: 10 },
      { name: '注入管理', icon: '[I]', path: '/admin/inject', component: 'Inject', parent: 0, sort: 11 },
      { name: '限制管理', icon: '[R]', path: '/admin/restrict', component: 'Restrict', parent: 0, sort: 12 },
      { name: '命令管理', icon: '[C]', path: '/admin/command', component: 'Command', parent: 0, sort: 13 },
      { name: '控件管理', icon: '[T]', path: '/admin/controls', component: 'Controls', parent: 0, sort: 14 },
      { name: '操作日志', icon: '[L]', path: '/admin/op-logs', component: 'OpLogs', parent: 0, sort: 15 },
      { name: 'SQL管理', icon: '[S]', path: '/admin/sql', component: 'Sql', parent: 0, sort: 16 },
      { name: '系统配置', icon: '[K]', path: '/admin/config', component: 'Config', parent: 0, sort: 17 },
      { name: '危险区', icon: '[!]', path: '/admin/danger', component: 'Danger', parent: 0, sort: 18 },
    ];
    const stmt = db.prepare("INSERT INTO menus (name, icon, path, component, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
    for (const m of menus) {
      stmt.run([m.name, m.icon, m.path, m.component, m.parent, m.sort]);
    }
    stmt.free();
    saveDb();
    console.log(`[Seed] 已插入 ${menus.length} 个菜单项`);
  }

  // ========== 超级管理员角色权限关联 ==========
  const rpCount = db.exec("SELECT COUNT(*) FROM role_permissions");
  if (!rpCount[0] || rpCount[0].values[0][0] === 0) {
    console.log('[Seed] 关联角色权限...');
    // 获取 super_admin 角色 ID
    const superAdmin = db.exec("SELECT id FROM roles WHERE name = 'super_admin'")[0];
    if (superAdmin) {
      const superAdminId = superAdmin.values[0][0];
      // 获取所有权限 ID
      const allPerms = db.exec("SELECT id FROM permissions")[0];
      if (allPerms) {
        const stmt = db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
        for (const row of allPerms.values) {
          stmt.run([superAdminId, row[0]]);
        }
        stmt.free();
        saveDb();
        console.log(`[Seed] 已为超级管理员关联所有权限`);
      }
    }
  }

  // ========== 超级管理员角色菜单关联 ==========
  const rmCount = db.exec("SELECT COUNT(*) FROM role_menus");
  if (!rmCount[0] || rmCount[0].values[0][0] === 0) {
    console.log('[Seed] 关联角色菜单...');
    const superAdmin = db.exec("SELECT id FROM roles WHERE name = 'super_admin'")[0];
    if (superAdmin) {
      const superAdminId = superAdmin.values[0][0];
      const allMenus = db.exec("SELECT id FROM menus")[0];
      if (allMenus) {
        const stmt = db.prepare("INSERT OR IGNORE INTO role_menus (role_id, menu_id) VALUES (?, ?)");
        for (const row of allMenus.values) {
          stmt.run([superAdminId, row[0]]);
        }
        stmt.free();
        saveDb();
        console.log(`[Seed] 已为超级管理员关联所有菜单`);
      }
    }
  }

  // ========== root 用户关联超级管理员角色 ==========
  const urCount = db.exec("SELECT COUNT(*) FROM user_roles");
  if (!urCount[0] || urCount[0].values[0][0] === 0) {
    console.log('[Seed] 关联用户角色...');
    const rootUser = db.exec("SELECT id FROM users WHERE username = 'root'")[0];
    const superAdmin = db.exec("SELECT id FROM roles WHERE name = 'super_admin'")[0];
    if (rootUser && superAdmin) {
      db.run("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", [rootUser.values[0][0], superAdmin.values[0][0]]);
      saveDb();
      console.log(`[Seed] 已将 root 用户关联为超级管理员`);
    }
  }
}

module.exports = { seed };

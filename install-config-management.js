/**
 * 配置管理模块 - 完整实现脚本
 * 为 klakna-backend 添加配置管理功能
 * 包含：通用配置、联系我们、导航栏、APP版本、合约分享、收款账户、佣金配置
 */

const fs = require('fs');
const path = require('path');

// ========== 1. 添加到 db/queries.js ==========
const queriesFile = 'C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/db/queries.js';
let queriesContent = fs.readFileSync(queriesFile, 'utf8');

// 在 module.exports 前添加配置管理查询函数
const configQueries = `
// ========== 配置管理 ==========
// 通用配置 (config_settings)
function getConfigByCategory(category) {
  return queryAll('SELECT * FROM config_settings WHERE category = ? ORDER BY id', [category]);
}
function upsertConfig(category, key, value, label, valueType) {
  const existing = queryOne('SELECT id FROM config_settings WHERE category = ? AND key = ?', [category, key]);
  if (existing) {
    run('UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime(\\'now\') WHERE category = ? AND key = ?', [value, label || key, valueType || 'text', category, key]);
    return existing.id;
  } else {
    run('INSERT INTO config_settings (category, key, value, label, value_type) VALUES (?, ?, ?, ?, ?)', [category, key, value, label || key, valueType || 'text']);
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row ? row.id : 0;
  }
}
function deleteConfig(id) {
  run('DELETE FROM config_settings WHERE id = ?', [id]);
}

// 联系我们信息 (contact_info)
function getContactInfos() {
  return queryAll('SELECT * FROM contact_info ORDER BY id', []);
}
function getContactInfoById(id) {
  return queryOne('SELECT * FROM contact_info WHERE id = ?', [id]);
}
function createContactInfo(data) {
  const { type, title, content } = data;
  run('INSERT INTO contact_info (type, title, content) VALUES (?, ?, ?)', [type, title, content]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}
function updateContactInfo(id, data) {
  const { type, title, content } = data;
  const sets = [];
  const params = [];
  if (type !== undefined) { sets.push('type = ?'); params.push(type); }
  if (title !== undefined) { sets.push('title = ?'); params.push(title); }
  if (content !== undefined) { sets.push('content = ?'); params.push(content); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run('UPDATE contact_info SET ' + sets.join(', ') + ' WHERE id = ?', params);
}
function deleteContactInfo(id) {
  run('DELETE FROM contact_info WHERE id = ?', [id]);
}

// 导航栏配置 (navigation_config)
function getNavigationConfigs() {
  return queryAll('SELECT * FROM navigation_config ORDER BY sort_order, id', []);
}
function createNavigationConfig(data) {
  const { label, url, icon, sort_order, enabled } = data;
  run('INSERT INTO navigation_config (label, url, icon, sort_order, enabled) VALUES (?, ?, ?, ?, ?)', [label, url, icon || '', sort_order || 0, enabled !== undefined ? enabled : 1]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}
function updateNavigationConfig(id, data) {
  const { label, url, icon, sort_order, enabled } = data;
  const sets = [];
  const params = [];
  if (label !== undefined) { sets.push('label = ?'); params.push(label); }
  if (url !== undefined) { sets.push('url = ?'); params.push(url); }
  if (icon !== undefined) { sets.push('icon = ?'); params.push(icon); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
  if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run('UPDATE navigation_config SET ' + sets.join(', ') + ' WHERE id = ?', params);
}
function deleteNavigationConfig(id) {
  run('DELETE FROM navigation_config WHERE id = ?', [id]);
}
function toggleNavigationConfig(id, enabled) {
  run("UPDATE navigation_config SET enabled = ?, updated_at = datetime('now') WHERE id = ?", [enabled ? 1 : 0, id]);
}

// APP版本 (app_version)
function getAppVersions() {
  return queryAll('SELECT * FROM app_version ORDER BY id DESC', []);
}
function createAppVersion(data) {
  const { version, platform, download_url, force_update, release_notes } = data;
  run('INSERT INTO app_version (version, platform, download_url, force_update, release_notes) VALUES (?, ?, ?, ?, ?)', [version, platform, download_url, force_update ? 1 : 0, release_notes || '']);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}
function updateAppVersion(id, data) {
  const { version, platform, download_url, force_update, release_notes } = data;
  const sets = [];
  const params = [];
  if (version !== undefined) { sets.push('version = ?'); params.push(version); }
  if (platform !== undefined) { sets.push('platform = ?'); params.push(platform); }
  if (download_url !== undefined) { sets.push('download_url = ?'); params.push(download_url); }
  if (force_update !== undefined) { sets.push('force_update = ?'); params.push(force_update ? 1 : 0); }
  if (release_notes !== undefined) { sets.push('release_notes = ?'); params.push(release_notes); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run('UPDATE app_version SET ' + sets.join(', ') + ' WHERE id = ?', params);
}
function deleteAppVersion(id) {
  run('DELETE FROM app_version WHERE id = ?', [id]);
}

// 合约分享 (contract_share)
function getContractShares() {
  return queryAll('SELECT * FROM contract_share ORDER BY id DESC', []);
}
function createContractShare(data) {
  const { title, description, image_url, link_url, enabled } = data;
  run('INSERT INTO contract_share (title, description, image_url, link_url, enabled) VALUES (?, ?, ?, ?, ?)', [title, description || '', image_url || '', link_url || '', enabled !== undefined ? enabled : 1]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}
function updateContractShare(id, data) {
  const { title, description, image_url, link_url, enabled } = data;
  const sets = [];
  const params = [];
  if (title !== undefined) { sets.push('title = ?'); params.push(title); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description); }
  if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
  if (link_url !== undefined) { sets.push('link_url = ?'); params.push(link_url); }
  if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run('UPDATE contract_share SET ' + sets.join(', ') + ' WHERE id = ?', params);
}
function deleteContractShare(id) {
  run('DELETE FROM contract_share WHERE id = ?', [id]);
}
function toggleContractShare(id, enabled) {
  run("UPDATE contract_share SET enabled = ?, updated_at = datetime('now') WHERE id = ?", [enabled ? 1 : 0, id]);
}

// 收款账户 (payment_account)
function getPaymentAccounts() {
  return queryAll('SELECT * FROM payment_account ORDER BY id DESC', []);
}
function createPaymentAccount(data) {
  const { name, account_type, account_info, qrcode_url, enabled } = data;
  run('INSERT INTO payment_account (name, account_type, account_info, qrcode_url, enabled) VALUES (?, ?, ?, ?, ?)', [name, account_type || '', account_info || '', qrcode_url || '', enabled !== undefined ? enabled : 1]);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}
function updatePaymentAccount(id, data) {
  const { name, account_type, account_info, qrcode_url, enabled } = data;
  const sets = [];
  const params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name); }
  if (account_type !== undefined) { sets.push('account_type = ?'); params.push(account_type); }
  if (account_info !== undefined) { sets.push('account_info = ?'); params.push(account_info); }
  if (qrcode_url !== undefined) { sets.push('qrcode_url = ?'); params.push(qrcode_url); }
  if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run('UPDATE payment_account SET ' + sets.join(', ') + ' WHERE id = ?', params);
}
function deletePaymentAccount(id) {
  run('DELETE FROM payment_account WHERE id = ?', [id]);
}
function togglePaymentAccount(id, enabled) {
  run("UPDATE payment_account SET enabled = ?, updated_at = datetime('now') WHERE id = ?", [enabled ? 1 : 0, id]);
}

// 佣金配置 (commission_config)
function getCommissionConfigs() {
  return queryAll('SELECT * FROM commission_config ORDER BY level', []);
}
function upsertCommissionConfig(data) {
  const { level, rate, min_amount, max_amount } = data;
  const existing = queryOne('SELECT id FROM commission_config WHERE level = ?', [level]);
  if (existing) {
    const sets = [];
    const params = [];
    if (rate !== undefined) { sets.push('rate = ?'); params.push(rate); }
    if (min_amount !== undefined) { sets.push('min_amount = ?'); params.push(min_amount); }
    if (max_amount !== undefined) { sets.push('max_amount = ?'); params.push(max_amount); }
    sets.push("updated_at = datetime('now')");
    params.push(level);
    run('UPDATE commission_config SET ' + sets.join(', ') + ' WHERE level = ?', params);
    return existing.id;
  } else {
    run('INSERT INTO commission_config (level, rate, min_amount, max_amount) VALUES (?, ?, ?, ?)', [level, rate || 0, min_amount || 0, max_amount || 0]);
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row ? row.id : 0;
  }
}
function deleteCommissionConfig(id) {
  run('DELETE FROM commission_config WHERE id = ?', [id]);
}
`;

// 在 module.exports 前插入
if (!queriesContent.includes('function getConfigByCategory(')) {
  const moduleExportsIndex = queriesContent.indexOf('module.exports = {');
  if (moduleExportsIndex !== -1) {
    queriesContent = queriesContent.slice(0, moduleExportsIndex) + configQueries + '\n' + queriesContent.slice(moduleExportsIndex);
    console.log('[1/3] Added query functions to db/queries.js');
  }
} else {
  console.log('[1/3] Query functions already exist, skipping');
}

// 添加到 module.exports
if (!queriesContent.includes('getConfigByCategory')) {
  queriesContent = queriesContent.replace(
    'module.exports = {',
    `module.exports = {
  // 配置管理
  getConfigByCategory, upsertConfig, deleteConfig,
  getContactInfos, getContactInfoById, createContactInfo, updateContactInfo, deleteContactInfo,
  getNavigationConfigs, createNavigationConfig, updateNavigationConfig, deleteNavigationConfig, toggleNavigationConfig,
  getAppVersions, createAppVersion, updateAppVersion, deleteAppVersion,
  getContractShares, createContractShare, updateContractShare, deleteContractShare, toggleContractShare,
  getPaymentAccounts, createPaymentAccount, updatePaymentAccount, deletePaymentAccount, togglePaymentAccount,
  getCommissionConfigs, upsertCommissionConfig, deleteCommissionConfig,`
  );
  console.log('[1/3] Added exports to db/queries.js');
}

fs.writeFileSync(queriesFile, queriesContent, 'utf8');
console.log('[1/3] db/queries.js updated successfully');

// ========== 2. 添加到 routes/admin-handlers.js ==========
const handlersFile = 'C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/routes/admin-handlers.js';
let handlersContent = fs.readFileSync(handlersFile, 'utf8');

// 添加导入
if (!handlersContent.includes('getConfigByCategory')) {
  handlersContent = handlersContent.replace(
    "  getWalletConfigs, getWalletConfigById, getWalletConfigByType, createWalletConfig, updateWalletConfig, deleteWalletConfig, toggleWalletConfig,",
    `  getWalletConfigs, getWalletConfigById, getWalletConfigByType, createWalletConfig, updateWalletConfig, deleteWalletConfig, toggleWalletConfig,
  // ========== 配置管理 ==========
  getConfigByCategory, upsertConfig, deleteConfig,
  getContactInfos, getContactInfoById, createContactInfo, updateContactInfo, deleteContactInfo,
  getNavigationConfigs, createNavigationConfig, updateNavigationConfig, deleteNavigationConfig, toggleNavigationConfig,
  getAppVersions, createAppVersion, updateAppVersion, deleteAppVersion,
  getContractShares, createContractShare, updateContractShare, deleteContractShare, toggleContractShare,
  getPaymentAccounts, createPaymentAccount, updatePaymentAccount, deletePaymentAccount, togglePaymentAccount,
  getCommissionConfigs, upsertCommissionConfig, deleteCommissionConfig,`
  );
  console.log('[2/3] Added imports to admin-handlers.js');
} else {
  console.log('[2/3] Imports already exist, skipping');
}

// 添加处理函数（在模块末尾，在 module.exports 前）
const configHandlers = `
// ========== 配置管理 API ==========

// 通用配置
async function handleConfigSettingsList(body) {
  const { category } = body;
  if (!category) return { code: 400, data: null, msg: 'category required' };
  const list = getConfigByCategory(category);
  return { code: 200, data: { list }, msg: 'success' };
}
async function handleConfigSettingsUpdate(body) {
  const { category, key, value, label, value_type } = body;
  if (!category || !key) return { code: 400, data: null, msg: 'category and key required' };
  const id = upsertConfig(category, key, value || '', label || key, value_type || 'text');
  return { code: 200, data: { id }, msg: 'Config updated' };
}
async function handleConfigSettingsDelete(body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteConfig(id);
  return { code: 200, data: null, msg: 'Config deleted' };
}

// 联系我们信息
async function handleContactInfoList() {
  const list = getContactInfos();
  return { code: 200, data: { list }, msg: 'success' };
}
async function handleContactInfoCreate(body) {
  const { type, title, content } = body;
  if (!type || !title || !content) return { code: 400, data: null, msg: 'type, title, content required' };
  const id = createContactInfo({ type, title, content });
  return { code: 200, data: { id }, msg: 'Contact info created' };
}
async function handleContactInfoUpdate(body) {
  const { id, type, title, content } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  updateContactInfo(id, { type, title, content });
  return { code: 200, data: null, msg: 'Contact info updated' };
}
async function handleContactInfoDelete(body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteContactInfo(id);
  return { code: 200, data: null, msg: 'Contact info deleted' };
}

// 导航栏配置
async function handleNavigationConfigList() {
  const list = getNavigationConfigs();
  return { code: 200, data: { list }, msg: 'success' };
}
async function handleNavigationConfigCreate(body) {
  const { label, url, icon, sort_order, enabled } = body;
  if (!label || !url) return { code: 400, data: null, msg: 'label and url required' };
  const id = createNavigationConfig({ label, url, icon, sort_order, enabled });
  return { code: 200, data: { id }, msg: 'Navigation config created' };
}
async function handleNavigationConfigUpdate(body) {
  const { id, label, url, icon, sort_order, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  updateNavigationConfig(id, { label, url, icon, sort_order, enabled });
  return { code: 200, data: null, msg: 'Navigation config updated' };
}
async function handleNavigationConfigDelete(body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteNavigationConfig(id);
  return { code: 200, data: null, msg: 'Navigation config deleted' };
}
async function handleNavigationConfigToggle(body) {
  const { id, enabled } = body;
  if (!id || enabled === undefined) return { code: 400, data: null, msg: 'id and enabled required' };
  toggleNavigationConfig(id, enabled);
  return { code: 200, data: null, msg: 'Navigation config toggled' };
}

// APP版本
async function handleAppVersionList() {
  const list = getAppVersions();
  return { code: 200, data: { list }, msg: 'success' };
}
async function handleAppVersionCreate(body) {
  const { version, platform, download_url, force_update, release_notes } = body;
  if (!version || !platform || !download_url) return { code: 400, data: null, msg: 'version, platform, download_url required' };
  const id = createAppVersion({ version, platform, download_url, force_update, release_notes });
  return { code: 200, data: { id }, msg: 'App version created' };
}
async function handleAppVersionUpdate(body) {
  const { id, version, platform, download_url, force_update, release_notes } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  updateAppVersion(id, { version, platform, download_url, force_update, release_notes });
  return { code: 200, data: null, msg: 'App version updated' };
}
async function handleAppVersionDelete(body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteAppVersion(id);
  return { code: 200, data: null, msg: 'App version deleted' };
}

// 合约分享
async function handleContractShareList() {
  const list = getContractShares();
  return { code: 200, data: { list }, msg: 'success' };
}
async function handleContractShareCreate(body) {
  const { title, description, image_url, link_url, enabled } = body;
  if (!title) return { code: 400, data: null, msg: 'title required' };
  const id = createContractShare({ title, description, image_url, link_url, enabled });
  return { code: 200, data: { id }, msg: 'Contract share created' };
}
async function handleContractShareUpdate(body) {
  const { id, title, description, image_url, link_url, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  updateContractShare(id, { title, description, image_url, link_url, enabled });
  return { code: 200, data: null, msg: 'Contract share updated' };
}
async function handleContractShareDelete(body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteContractShare(id);
  return { code: 200, data: null, msg: 'Contract share deleted' };
}
async function handleContractShareToggle(body) {
  const { id, enabled } = body;
  if (!id || enabled === undefined) return { code: 400, data: null, msg: 'id and enabled required' };
  toggleContractShare(id, enabled);
  return { code: 200, data: null, msg: 'Contract share toggled' };
}

// 收款账户
async function handlePaymentAccountList() {
  const list = getPaymentAccounts();
  return { code: 200, data: { list }, msg: 'success' };
}
async function handlePaymentAccountCreate(body) {
  const { name, account_type, account_info, qrcode_url, enabled } = body;
  if (!name) return { code: 400, data: null, msg: 'name required' };
  const id = createPaymentAccount({ name, account_type, account_info, qrcode_url, enabled });
  return { code: 200, data: { id }, msg: 'Payment account created' };
}
async function handlePaymentAccountUpdate(body) {
  const { id, name, account_type, account_info, qrcode_url, enabled } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  updatePaymentAccount(id, { name, account_type, account_info, qrcode_url, enabled });
  return { code: 200, data: null, msg: 'Payment account updated' };
}
async function handlePaymentAccountDelete(body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deletePaymentAccount(id);
  return { code: 200, data: null, msg: 'Payment account deleted' };
}
async function handlePaymentAccountToggle(body) {
  const { id, enabled } = body;
  if (!id || enabled === undefined) return { code: 400, data: null, msg: 'id and enabled required' };
  togglePaymentAccount(id, enabled);
  return { code: 200, data: null, msg: 'Payment account toggled' };
}

// 佣金配置
async function handleCommissionConfigList() {
  const list = getCommissionConfigs();
  return { code: 200, data: { list }, msg: 'success' };
}
async function handleCommissionConfigUpsert(body) {
  const { level, rate, min_amount, max_amount } = body;
  if (!level) return { code: 400, data: null, msg: 'level required' };
  const id = upsertCommissionConfig({ level, rate, min_amount, max_amount });
  return { code: 200, data: { id }, msg: 'Commission config updated' };
}
async function handleCommissionConfigDelete(body) {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'id required' };
  deleteCommissionConfig(id);
  return { code: 200, data: null, msg: 'Commission config deleted' };
}
`;

// 添加到 admin-handlers.js 末尾（在 module.exports 前）
if (!handlersContent.includes('handleConfigSettingsList')) {
  const moduleExportsIndex = handlersContent.indexOf('module.exports = {');
  if (moduleExportsIndex !== -1) {
    handlersContent = handlersContent.slice(0, moduleExportsIndex) + configHandlers + '\n' + handlersContent.slice(moduleExportsIndex);
    fs.writeFileSync(handlersFile, handlersContent, 'utf8');
    console.log('[2/3] Added handler functions to admin-handlers.js');
  }
} else {
  console.log('[2/3] Handler functions already exist, skipping');
}

// 添加路由匹配（在 match 函数中）
if (!handlersContent.includes('/admin/config-settings/list')) {
  const matchFunction = handlersContent.match(/function match\(method, path\) \{[\s\S]*?return null;\s*\}/);
  if (matchFunction) {
    const newRoutes = `
  // 配置管理
  if (method === 'POST' && path === '/admin/config-settings/list') return handleConfigSettingsList;
  if (method === 'POST' && path === '/admin/config-settings/update') return handleConfigSettingsUpdate;
  if (method === 'POST' && path === '/admin/config-settings/delete') return handleConfigSettingsDelete;
  if (method === 'POST' && path === '/admin/contact-info/list') return handleContactInfoList;
  if (method === 'POST' && path === '/admin/contact-info/create') return handleContactInfoCreate;
  if (method === 'POST' && path === '/admin/contact-info/update') return handleContactInfoUpdate;
  if (method === 'POST' && path === '/admin/contact-info/delete') return handleContactInfoDelete;
  if (method === 'POST' && path === '/admin/navigation-config/list') return handleNavigationConfigList;
  if (method === 'POST' && path === '/admin/navigation-config/create') return handleNavigationConfigCreate;
  if (method === 'POST' && path === '/admin/navigation-config/update') return handleNavigationConfigUpdate;
  if (method === 'POST' && path === '/admin/navigation-config/delete') return handleNavigationConfigDelete;
  if (method === 'POST' && path === '/admin/navigation-config/toggle') return handleNavigationConfigToggle;
  if (method === 'POST' && path === '/admin/app-version/list') return handleAppVersionList;
  if (method === 'POST' && path === '/admin/app-version/create') return handleAppVersionCreate;
  if (method === 'POST' && path === '/admin/app-version/update') return handleAppVersionUpdate;
  if (method === 'POST' && path === '/admin/app-version/delete') return handleAppVersionDelete;
  if (method === 'POST' && path === '/admin/contract-share/list') return handleContractShareList;
  if (method === 'POST' && path === '/admin/contract-share/create') return handleContractShareCreate;
  if (method === 'POST' && path === '/admin/contract-share/update') return handleContractShareUpdate;
  if (method === 'POST' && path === '/admin/contract-share/delete') return handleContractShareDelete;
  if (method === 'POST' && path === '/admin/contract-share/toggle') return handleContractShareToggle;
  if (method === 'POST' && path === '/admin/payment-account/list') return handlePaymentAccountList;
  if (method === 'POST' && path === '/admin/payment-account/create') return handlePaymentAccountCreate;
  if (method === 'POST' && path === '/admin/payment-account/update') return handlePaymentAccountUpdate;
  if (method === 'POST' && path === '/admin/payment-account/delete') return handlePaymentAccountDelete;
  if (method === 'POST' && path === '/admin/payment-account/toggle') return handlePaymentAccountToggle;
  if (method === 'POST' && path === '/admin/commission-config/list') return handleCommissionConfigList;
  if (method === 'POST' && path === '/admin/commission-config/upsert') return handleCommissionConfigUpsert;
  if (method === 'POST' && path === '/admin/commission-config/delete') return handleCommissionConfigDelete;
`;
    handlersContent = handlersContent.replace(
      /(function match\(method, path\) \{[\s\S]*?)(\s+return null;\s+\})/,
      '$1' + newRoutes + '$2'
    );
    fs.writeFileSync(handlersFile, handlersContent, 'utf8');
    console.log('[2/3] Added route matching to admin-handlers.js');
  }
} else {
  console.log('[2/3] Routes already exist, skipping');
}

console.log('[2/3] admin-handlers.js updated successfully');

// ========== 3. 添加到 public/admin-app.js ==========
const appJsFile = 'C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/public/admin-app.js';
let appJsContent = fs.readFileSync(appJsFile, 'utf8');

// 添加菜单项（在 NAV_ITEMS 的合适位置）
if (!appJsContent.includes('config-management')) {
  appJsContent = appJsContent.replace(
    /(\{key:'danger'.*?children:\s*\[[\s\S]*?\{key:'danger'.*?\},\s*\])\s*\}/,
    '$1,\n  {\n    key:\'config-management\',\n    icon:\'[C]\',\n    text:\'CONFIG MANAGEMENT\',\n    children: [\n      {key:\'general-config\', icon:\'[G]\', text:\'GENERAL CONFIG\'},\n      {key:\'contact-info\', icon:\'[C]\', text:\'CONTACT INFO\'},\n      {key:\'navigation-config\', icon:\'[N]\', text:\'NAVIGATION\'},\n      {key:\'app-version\', icon:\'[A]\', text:\'APP VERSION\'},\n      {key:\'contract-share\', icon:\'[S]\', text:\'CONTRACT SHARE\'},\n      {key:\'payment-account\', icon:\'[P]\', text:\'PAYMENT ACCOUNT\'},\n      {key:\'commission-config\', icon:\'[C]\', text:\'COMMISSION\'},\n    ]\n  }'
  );
  console.log('[3/3] Added menu items to admin-app.js');
} else {
  console.log('[3/3] Menu items already exist, skipping');
}

// 添加渲染函数到 renderers 对象
if (!appJsContent.includes("'general-config':pgGeneralConfig")) {
  appJsContent = appJsContent.replace(
    /(const renderers = \{[\s\S]*?)(\};)/,
    '$1  \'general-config\':pgGeneralConfig, \'contact-info\':pgContactInfo, \'navigation-config\':pgNavigationConfig,\n' +
    '  \'app-version\':pgAppVersion, \'contract-share\':pgContractShare, \'payment-account\':pgPaymentAccount,\n' +
    '  \'commission-config\':pgCommissionConfig,\n$2'
  );
  console.log('[3/3] Added renderers to admin-app.js');
} else {
  console.log('[3/3] Renderers already exist, skipping');
}

// 追加前端函数到文件末尾
const frontendFunctions = `
// ========== 配置管理前端函数 ==========

// 通用配置
async function pgGeneralConfig() {
  _curPage='general-config';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/config-settings/list',{category:'general'});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const configs=r.data?.list||[];
    const fields=[
      {key:'site_name',label:'站点名称',type:'text'},
      {key:'site_title_logo',label:'站点标题LOGO',type:'image'},
      {key:'site_header_logo',label:'站点头部LOGO',type:'image'},
      {key:'site_footer_logo',label:'站点底部LOGO',type:'image'},
      {key:'mobile_login_logo',label:'移动端登录LOGO',type:'image'},
      {key:'mobile_title_logo',label:'移动端标题LOGO',type:'image'},
      {key:'mobile_home_logo',label:'移动端首页LOGO',type:'image'},
      {key:'copyright',label:'版权信息',type:'textarea'},
    ];
    let html='<div class="card"><div class="card-header"><h3>通用配置 (GENERAL CONFIG)</h3></div><div class="card-body">';
    for(const f of fields){
      const cfg=configs.find(c=>c.key===f.key);
      const val=cfg?.value||'';
      if(f.type==='image'){
        html+='<div style="margin:12px 0"><b>'+f.label+':</b><br>';
        if(val) html+='<img src="'+H(val)+'" style="max-width:200px;max-height:60px;margin:8px 0"><br>';
        html+='<button class="btn btn-sm btn-accent" onclick="editGeneralConfig(\''+f.key+'\',\''+f.label+'\',\''+f.type+'\')">编辑</button></div>';
      } else {
        html+='<div style="margin:12px 0"><b>'+f.label+':</b> '+(val||'<span style="color:var(--text2)">未设置</span>')+' <button class="btn btn-sm btn-accent" onclick="editGeneralConfig(\''+f.key+'\',\''+f.label+'\',\''+f.type+'\')">编辑</button></div>';
      }
    }
    html+='</div></div>';
    el.innerHTML=html;
    _go['general-config']=pgGeneralConfig;
  } catch(e) {
    el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';
  }
}
async function editGeneralConfig(key,label,type){
  const body='<div style="line-height:2"><b>'+H(label)+':</b><br>'+
    (type==='textarea'?'<textarea id="cfgVal" style="width:300px;height:80px">'+'</textarea>':
     type==='image'?'<input type="text" id="cfgVal" placeholder="图片URL" style="width:300px">':
     '<input type="text" id="cfgVal" style="width:300px">')+
    '</div>';
  const footer='<button class="btn btn-accent" onclick="saveGeneralConfig(\''+key+'\',\''+type+'\')">Save</button>'+
               '<button class="btn" onclick="closeModal()">Cancel</button>';
  showModal('Edit '+H(label),body,footer);
}
async function saveGeneralConfig(key,type){
  const value=document.getElementById('cfgVal').value;
  const r=await api('/admin/config-settings/update',{category:'general',key,value,label:key,value_type:type});
  if(r.code===200){alert('[OK] Saved');closeModal();pgGeneralConfig();}
  else alert('[ERROR] '+r.msg);
}

// 联系我们信息
async function pgContactInfo(){
  _curPage='contact-info';
  const el=document.getElementById('contentArea');
  el.innerHTML='<div class="loading">[ LOADING... ]</div>';
  try {
    const r=await api('/admin/contact-info/list',{});
    if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}
    const list=r.data?.list||[];
    const rows=list.map(c=>'<tr><td>'+c.id+'</td><td>'+H(c.type||'')+'</td><td>'+H(c.title||'')+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+H(c.content||'')+'</td><td><button class="btn btn-sm btn-accent" onclick="editContactInfo('+c.id+')">编辑</button> <button class="btn btn-sm btn-danger" onclick="deleteContactInfo('+c.id+')">删除</button></td></tr>').join('');
    el.innerHTML='<div class="card"><div class="card-header"><h3>联系我们信息 (CONTACT INFO)</h3><div><button class="btn btn-success" onclick="createContactInfo()">+ 添加</button></div></div>'+
      '<div class="card-body" style="overflow-x:auto"><table><thead><tr><th>ID</th><th>类型</th><th>标题</th><th>内容</th><th>操作</th></tr></thead><tbody>'+
      (rows||'<tr><td colspan="5" style="text-align:center;color:var(--text2)">无数据</td></tr>')+'</tbody></table></div></div>';
    _go['contact-info']=pgContactInfo;
  } catch(e){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';}
}
async function createContactInfo(){
  const body='<div style="line-height:2"><b>Type:</b> <select id="ciType" style="padding:6px"><option value="联系信息">联系信息</option><option value="常规咨询">常规咨询</option><option value="客户服务">客户服务</option><option value="媒体合作">媒体合作</option></select><br><b>Title:</b> <input type="text" id="ciTitle" style="width:200px"><br><b>Content:</b><br><textarea id="ciContent" style="width:300px;height:80px"></textarea></div>';
  const footer='<button class="btn btn-accent" onclick="saveContactInfo()">Create</button><button class="btn" onclick="closeModal()">Cancel</button>';
  showModal('Create Contact Info',body,footer);
}
async function saveContactInfo(id){
  const type=document.getElementById('ciType').value;
  const title=document.getElementById('ciTitle').value.trim();
  const content=document.getElementById('ciContent').value.trim();
  if(!type||!title||!content){alert('Required fields missing');return;}
  const r=id?await api('/admin/contact-info/update',{id,type,title,content}):await api('/admin/contact-info/create',{type,title,content});
  if(r.code===200){alert('[OK] Saved');closeModal();pgContactInfo();}
  else alert('[ERROR] '+r.msg);
}
async function editContactInfo(id){
  const r=await api('/admin/contact-info/list',{});
  const item=r.data?.list?.find(c=>c.id===id);
  if(!item){alert('Not found');return;}
  const body='<div style="line-height:2"><b>Type:</b> <select id="ciType" style="padding:6px"><option value="联系信息"'+(item.type==='联系信息'?' selected':'')+'>联系信息</option><option value="常规咨询"'+(item.type==='常规咨询'?' selected':'')+'>常规咨询</option><option value="客户服务"'+(item.type==='客户服务'?' selected':'')+'>客户服务</option><option value="媒体合作"'+(item.type==='媒体合作'?' selected':'')+'>媒体合作</option></select><br><b>Title:</b> <input type="text" id="ciTitle" value="'+H(item.title||'')+'" style="width:200px"><br><b>Content:</b><br><textarea id="ciContent" style="width:300px;height:80px">'+H(item.content||'')+'</textarea></div>';
  const footer='<button class="btn btn-accent" onclick="saveContactInfo('+id+')">Update</button><button class="btn" onclick="closeModal()">Cancel</button>';
  showModal('Edit Contact Info',body,footer);
}
async function deleteContactInfo(id){if(!confirm('确认删除？'))return;const r=await api('/admin/contact-info/delete',{id});if(r.code===200){alert('[OK] Deleted');pgContactInfo();}else alert('[ERROR] '+r.msg);}

// 导航栏配置
async function pgNavigationConfig(){_curPage='navigation-config';const el=document.getElementById('contentArea');el.innerHTML='<div class="loading">[ LOADING... ]</div>';try{const r=await api('/admin/navigation-config/list',{});if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}const list=r.data?.list||[];const rows=list.map(n=>'<tr><td>'+n.id+'</td><td>'+H(n.label||'')+'</td><td>'+H(n.url||'')+'</td><td>'+H(n.icon||'')+'</td><td>'+n.sort_order+'</td><td>'+(n.enabled?'<span style="color:var(--success)">启用</span>':'<span style="color:var(--danger)">禁用</span>')+'</td><td><button class="btn btn-sm btn-accent" onclick="editNavigationConfig('+n.id+')">编辑</button> <button class="btn btn-sm btn-danger" onclick="deleteNavigationConfig('+n.id+')">删除</button> <button class="btn btn-sm '+(n.enabled?'btn-warning':'btn-success')+'" onclick="toggleNavigationConfig('+n.id+','+(n.enabled?0:1)+')">'+(n.enabled?'禁用':'启用')+'</button></td></tr>').join('');el.innerHTML='<div class="card"><div class="card-header"><h3>导航栏配置 (NAVIGATION)</h3><div><button class="btn btn-success" onclick="createNavigationConfig()">+ 添加</button></div></div><div class="card-body" style="overflow-x:auto"><table><thead><tr><th>ID</th><th>标签</th><th>URL</th><th>图标</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" style="text-align:center;color:var(--text2)">无数据</td></tr>')+'</tbody></table></div></div>';_go['navigation-config']=pgNavigationConfig;}catch(e){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';}} 
async function createNavigationConfig(){const body='<div style="line-height:2"><b>Label:</b> <input type="text" id="navLabel" style="width:200px"><br><b>URL:</b> <input type="text" id="navUrl" style="width:300px"><br><b>Icon:</b> <input type="text" id="navIcon" style="width:200px"><br><b>Sort Order:</b> <input type="number" id="navSort" value="0" style="width:100px"></div>';const footer='<button class="btn btn-accent" onclick="saveNavigationConfig()">Create</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Create Navigation Item',body,footer);}
async function saveNavigationConfig(id){const label=document.getElementById('navLabel').value.trim();const url=document.getElementById('navUrl').value.trim();const icon=document.getElementById('navIcon').value.trim();const sort_order=parseInt(document.getElementById('navSort').value)||0;if(!label||!url){alert('Required fields missing');return;}const r=id?await api('/admin/navigation-config/update',{id,label,url,icon,sort_order}):await api('/admin/navigation-config/create',{label,url,icon,sort_order});if(r.code===200){alert('[OK] Saved');closeModal();pgNavigationConfig();}else alert('[ERROR] '+r.msg);}
async function editNavigationConfig(id){const r=await api('/admin/navigation-config/list',{});const item=r.data?.list?.find(n=>n.id===id);if(!item){alert('Not found');return;}const body='<div style="line-height:2"><b>Label:</b> <input type="text" id="navLabel" value="'+H(item.label||'')+'" style="width:200px"><br><b>URL:</b> <input type="text" id="navUrl" value="'+H(item.url||'')+'" style="width:300px"><br><b>Icon:</b> <input type="text" id="navIcon" value="'+H(item.icon||'')+'" style="width:200px"><br><b>Sort Order:</b> <input type="number" id="navSort" value="'+item.sort_order+'" style="width:100px"></div>';const footer='<button class="btn btn-accent" onclick="saveNavigationConfig('+id+')">Update</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Edit Navigation Item',body,footer);}
async function deleteNavigationConfig(id){if(!confirm('确认删除？'))return;const r=await api('/admin/navigation-config/delete',{id});if(r.code===200){alert('[OK] Deleted');pgNavigationConfig();}else alert('[ERROR] '+r.msg);}
async function toggleNavigationConfig(id,enabled){const r=await api('/admin/navigation-config/toggle',{id,enabled});if(r.code===200){pgNavigationConfig();}else alert('[ERROR] '+r.msg);}

// APP版本
async function pgAppVersion(){_curPage='app-version';const el=document.getElementById('contentArea');el.innerHTML='<div class="loading">[ LOADING... ]</div>';try{const r=await api('/admin/app-version/list',{});if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}const list=r.data?.list||[];const rows=list.map(v=>'<tr><td>'+v.id+'</td><td>'+H(v.version||'')+'</td><td>'+H(v.platform||'')+'</td><td><a href="'+H(v.download_url||'')+'" target="_blank" style="font-size:11px">'+H(v.download_url||'')+'</a></td><td>'+(v.force_update?'<span style="color:var(--danger)">强制</span>':'<span style="color:var(--success)">可选</span>')+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+H(v.release_notes||'')+'</td><td><button class="btn btn-sm btn-accent" onclick="editAppVersion('+v.id+')">编辑</button> <button class="btn btn-sm btn-danger" onclick="deleteAppVersion('+v.id+')">删除</button></td></tr>').join('');el.innerHTML='<div class="card"><div class="card-header"><h3>APP版本 (APP VERSION)</h3><div><button class="btn btn-success" onclick="createAppVersion()">+ 添加</button></div></div><div class="card-body" style="overflow-x:auto"><table><thead><tr><th>ID</th><th>版本</th><th>平台</th><th>下载链接</th><th>强制更新</th><th>发布说明</th><th>操作</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" style="text-align:center;color:var(--text2)">无数据</td></tr>')+'</tbody></table></div></div>';_go['app-version']=pgAppVersion;}catch(e){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';}}
async function createAppVersion(){const body='<div style="line-height:2"><b>Version:</b> <input type="text" id="avVersion" placeholder="1.0.0" style="width:200px"><br><b>Platform:</b> <select id="avPlatform" style="padding:6px"><option value="iOS">iOS</option><option value="Android">Android</option><option value="Both">Both</option></select><br><b>Download URL:</b> <input type="text" id="avDownload" style="width:300px"><br><b>Force Update:</b> <select id="avForce" style="padding:6px"><option value="0">No</option><option value="1">Yes</option></select><br><b>Release Notes:</b><br><textarea id="avNotes" style="width:300px;height:60px"></textarea></div>';const footer='<button class="btn btn-accent" onclick="saveAppVersion()">Create</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Create App Version',body,footer);}
async function saveAppVersion(id){const version=document.getElementById('avVersion').value.trim();const platform=document.getElementById('avPlatform').value;const download_url=document.getElementById('avDownload').value.trim();const force_update=parseInt(document.getElementById('avForce').value);const release_notes=document.getElementById('avNotes').value.trim();if(!version||!platform||!download_url){alert('Required fields missing');return;}const r=id?await api('/admin/app-version/update',{id,version,platform,download_url,force_update,release_notes}):await api('/admin/app-version/create',{version,platform,download_url,force_update,release_notes});if(r.code===200){alert('[OK] Saved');closeModal();pgAppVersion();}else alert('[ERROR] '+r.msg);}
async function editAppVersion(id){const r=await api('/admin/app-version/list',{});const item=r.data?.list?.find(v=>v.id===id);if(!item){alert('Not found');return;}const body='<div style="line-height:2"><b>Version:</b> <input type="text" id="avVersion" value="'+H(item.version||'')+'" style="width:200px"><br><b>Platform:</b> <select id="avPlatform" style="padding:6px"><option value="iOS"'+(item.platform==='iOS'?' selected':'')+'>iOS</option><option value="Android"'+(item.platform==='Android'?' selected':'')+'>Android</option><option value="Both"'+(item.platform==='Both'?' selected':'')+'>Both</option></select><br><b>Download URL:</b> <input type="text" id="avDownload" value="'+H(item.download_url||'')+'" style="width:300px"><br><b>Force Update:</b> <select id="avForce" style="padding:6px"><option value="0"'+(!item.force_update?' selected':'')+'>No</option><option value="1"'+(item.force_update?' selected':'')+'>Yes</option></select><br><b>Release Notes:</b><br><textarea id="avNotes" style="width:300px;height:60px">'+H(item.release_notes||'')+'</textarea></div>';const footer='<button class="btn btn-accent" onclick="saveAppVersion('+id+')">Update</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Edit App Version',body,footer);}
async function deleteAppVersion(id){if(!confirm('确认删除？'))return;const r=await api('/admin/app-version/delete',{id});if(r.code===200){alert('[OK] Deleted');pgAppVersion();}else alert('[ERROR] '+r.msg);}

// 合约分享
async function pgContractShare(){_curPage='contract-share';const el=document.getElementById('contentArea');el.innerHTML='<div class="loading">[ LOADING... ]</div>';try{const r=await api('/admin/contract-share/list',{});if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}const list=r.data?.list||[];const rows=list.map(c=>'<tr><td>'+c.id+'</td><td>'+H(c.title||'')+'</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis">'+H(c.description||'')+'</td><td><img src="'+H(c.image_url||'')+'" style="max-width:60px;max-height:60px"></td><td><a href="'+H(c.link_url||'')+'" target="_blank" style="font-size:11px">Link</a></td><td>'+(c.enabled?'<span style="color:var(--success)">启用</span>':'<span style="color:var(--danger)">禁用</span>')+'</td><td><button class="btn btn-sm btn-accent" onclick="editContractShare('+c.id+')">编辑</button> <button class="btn btn-sm btn-danger" onclick="deleteContractShare('+c.id+')">删除</button> <button class="btn btn-sm '+(c.enabled?'btn-warning':'btn-success')+'" onclick="toggleContractShare('+c.id+','+(c.enabled?0:1)+')">'+(c.enabled?'禁用':'启用')+'</button></td></tr>').join('');el.innerHTML='<div class="card"><div class="card-header"><h3>合约分享 (CONTRACT SHARE)</h3><div><button class="btn btn-success" onclick="createContractShare()">+ 添加</button></div></div><div class="card-body" style="overflow-x:auto"><table><thead><tr><th>ID</th><th>标题</th><th>描述</th><th>图片</th><th>链接</th><th>状态</th><th>操作</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" style="text-align:center;color:var(--text2)">无数据</td></tr>')+'</tbody></table></div></div>';_go['contract-share']=pgContractShare;}catch(e){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';}}
async function createContractShare(){const body='<div style="line-height:2"><b>Title:</b> <input type="text" id="csTitle" style="width:200px"><br><b>Description:</b><br><textarea id="csDesc" style="width:300px;height:60px"></textarea><br><b>Image URL:</b> <input type="text" id="csImage" style="width:300px"><br><b>Link URL:</b> <input type="text" id="csLink" style="width:300px"></div>';const footer='<button class="btn btn-accent" onclick="saveContractShare()">Create</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Create Contract Share',body,footer);}
async function saveContractShare(id){const title=document.getElementById('csTitle').value.trim();const description=document.getElementById('csDesc').value.trim();const image_url=document.getElementById('csImage').value.trim();const link_url=document.getElementById('csLink').value.trim();if(!title){alert('Title required');return;}const r=id?await api('/admin/contract-share/update',{id,title,description,image_url,link_url}):await api('/admin/contract-share/create',{title,description,image_url,link_url});if(r.code===200){alert('[OK] Saved');closeModal();pgContractShare();}else alert('[ERROR] '+r.msg);}
async function editContractShare(id){const r=await api('/admin/contract-share/list',{});const item=r.data?.list?.find(c=>c.id===id);if(!item){alert('Not found');return;}const body='<div style="line-height:2"><b>Title:</b> <input type="text" id="csTitle" value="'+H(item.title||'')+'" style="width:200px"><br><b>Description:</b><br><textarea id="csDesc" style="width:300px;height:60px">'+H(item.description||'')+'</textarea><br><b>Image URL:</b> <input type="text" id="csImage" value="'+H(item.image_url||'')+'" style="width:300px"><br><b>Link URL:</b> <input type="text" id="csLink" value="'+H(item.link_url||'')+'" style="width:300px"></div>';const footer='<button class="btn btn-accent" onclick="saveContractShare('+id+')">Update</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Edit Contract Share',body,footer);}
async function deleteContractShare(id){if(!confirm('确认删除？'))return;const r=await api('/admin/contract-share/delete',{id});if(r.code===200){alert('[OK] Deleted');pgContractShare();}else alert('[ERROR] '+r.msg);}
async function toggleContractShare(id,enabled){const r=await api('/admin/contract-share/toggle',{id,enabled});if(r.code===200){pgContractShare();}else alert('[ERROR] '+r.msg);}

// 收款账户
async function pgPaymentAccount(){_curPage='payment-account';const el=document.getElementById('contentArea');el.innerHTML='<div class="loading">[ LOADING... ]</div>';try{const r=await api('/admin/payment-account/list',{});if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}const list=r.data?.list||[];const rows=list.map(p=>'<tr><td>'+p.id+'</td><td>'+H(p.name||'')+'</td><td>'+H(p.account_type||'')+'</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis">'+H(p.account_info||'')+'</td><td>'+(p.qrcode_url?'<img src="'+H(p.qrcode_url)+'" style="max-width:60px;max-height:60px">':'')+'</td><td>'+(p.enabled?'<span style="color:var(--success)">启用</span>':'<span style="color:var(--danger)">禁用</span>')+'</td><td><button class="btn btn-sm btn-accent" onclick="editPaymentAccount('+p.id+')">编辑</button> <button class="btn btn-sm btn-danger" onclick="deletePaymentAccount('+p.id+')">删除</button> <button class="btn btn-sm '+(p.enabled?'btn-warning':'btn-success')+'" onclick="togglePaymentAccount('+p.id+','+(p.enabled?0:1)+')">'+(p.enabled?'禁用':'启用')+'</button></td></tr>').join('');el.innerHTML='<div class="card"><div class="card-header"><h3>收款账户 (PAYMENT ACCOUNT)</h3><div><button class="btn btn-success" onclick="createPaymentAccount()">+ 添加</button></div></div><div class="card-body" style="overflow-x:auto"><table><thead><tr><th>ID</th><th>名称</th><th>类型</th><th>账户信息</th><th>二维码</th><th>状态</th><th>操作</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" style="text-align:center;color:var(--text2)">无数据</td></tr>')+'</tbody></table></div></div>';_go['payment-account']=pgPaymentAccount;}catch(e){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';}}
async function createPaymentAccount(){const body='<div style="line-height:2"><b>Name:</b> <input type="text" id="paName" style="width:200px"><br><b>Account Type:</b> <select id="paType" style="padding:6px"><option value="alipay">Alipay</option><option value="wechat">WeChat</option><option value="bank">Bank</option><option value="other">Other</option></select><br><b>Account Info:</b> <input type="text" id="paInfo" style="width:300px"><br><b>QRCode URL:</b> <input type="text" id="paQR" style="width:300px"></div>';const footer='<button class="btn btn-accent" onclick="savePaymentAccount()">Create</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Create Payment Account',body,footer);}
async function savePaymentAccount(id){const name=document.getElementById('paName').value.trim();const account_type=document.getElementById('paType').value;const account_info=document.getElementById('paInfo').value.trim();const qrcode_url=document.getElementById('paQR').value.trim();if(!name){alert('Name required');return;}const r=id?await api('/admin/payment-account/update',{id,name,account_type,account_info,qrcode_url}):await api('/admin/payment-account/create',{name,account_type,account_info,qrcode_url});if(r.code===200){alert('[OK] Saved');closeModal();pgPaymentAccount();}else alert('[ERROR] '+r.msg);}
async function editPaymentAccount(id){const r=await api('/admin/payment-account/list',{});const item=r.data?.list?.find(p=>p.id===id);if(!item){alert('Not found');return;}const body='<div style="line-height:2"><b>Name:</b> <input type="text" id="paName" value="'+H(item.name||'')+'" style="width:200px"><br><b>Account Type:</b> <select id="paType" style="padding:6px"><option value="alipay"'+(item.account_type==='alipay'?' selected':'')+'>Alipay</option><option value="wechat"'+(item.account_type==='wechat'?' selected':'')+'>WeChat</option><option value="bank"'+(item.account_type==='bank'?' selected':'')+'>Bank</option><option value="other"'+(item.account_type==='other'?' selected':'')+'>Other</option></select><br><b>Account Info:</b> <input type="text" id="paInfo" value="'+H(item.account_info||'')+'" style="width:300px"><br><b>QRCode URL:</b> <input type="text" id="paQR" value="'+H(item.qrcode_url||'')+'" style="width:300px"></div>';const footer='<button class="btn btn-accent" onclick="savePaymentAccount('+id+')">Update</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Edit Payment Account',body,footer);}
async function deletePaymentAccount(id){if(!confirm('确认删除？'))return;const r=await api('/admin/payment-account/delete',{id});if(r.code===200){alert('[OK] Deleted');pgPaymentAccount();}else alert('[ERROR] '+r.msg);}
async function togglePaymentAccount(id,enabled){const r=await api('/admin/payment-account/toggle',{id,enabled});if(r.code===200){pgPaymentAccount();}else alert('[ERROR] '+r.msg);}

// 佣金配置
async function pgCommissionConfig(){_curPage='commission-config';const el=document.getElementById('contentArea');el.innerHTML='<div class="loading">[ LOADING... ]</div>';try{const r=await api('/admin/commission-config/list',{});if(r.code!==200){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(r.msg)+'</div>';return;}const list=r.data?.list||[];const rows=list.map(c=>'<tr><td>'+c.id+'</td><td>Level '+c.level+'</td><td>'+(c.rate*100).toFixed(2)+'%</td><td>'+N(c.min_amount,2)+'</td><td>'+N(c.max_amount,2)+'</td><td><button class="btn btn-sm btn-accent" onclick="editCommissionConfig('+c.id+')">编辑</button> <button class="btn btn-sm btn-danger" onclick="deleteCommissionConfig('+c.id+')">删除</button></td></tr>').join('');el.innerHTML='<div class="card"><div class="card-header"><h3>佣金配置 (COMMISSION CONFIG)</h3><div><button class="btn btn-success" onclick="createCommissionConfig()">+ 添加</button></div></div><div class="card-body" style="overflow-x:auto"><table><thead><tr><th>ID</th><th>等级</th><th>费率</th><th>最小金额</th><th>最大金额</th><th>操作</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" style="text-align:center;color:var(--text2)">无数据</td></tr>')+'</tbody></table></div></div>';_go['commission-config']=pgCommissionConfig;}catch(e){el.innerHTML='<div class="empty" style="color:var(--danger)">'+H(e.message)+'</div>';}}
async function createCommissionConfig(){const body='<div style="line-height:2"><b>Level:</b> <input type="number" id="ccLevel" value="1" min="1" style="width:100px"><br><b>Rate (%):</b> <input type="number" id="ccRate" step="0.01" placeholder="0.05 = 5%" style="width:200px"><br><b>Min Amount:</b> <input type="number" id="ccMin" step="0.01" style="width:200px"><br><b>Max Amount:</b> <input type="number" id="ccMax" step="0.01" style="width:200px"></div>';const footer='<button class="btn btn-accent" onclick="saveCommissionConfig()">Create</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Create Commission Config',body,footer);}
async function saveCommissionConfig(id){const level=parseInt(document.getElementById('ccLevel').value);const rate=parseFloat(document.getElementById('ccRate').value)/100;const min_amount=parseFloat(document.getElementById('ccMin').value)||0;const max_amount=parseFloat(document.getElementById('ccMax').value)||0;if(!level){alert('Level required');return;}const r=id?await api('/admin/commission-config/upsert',{id,level,rate,min_amount,max_amount}):await api('/admin/commission-config/upsert',{level,rate,min_amount,max_amount});if(r.code===200){alert('[OK] Saved');closeModal();pgCommissionConfig();}else alert('[ERROR] '+r.msg);}
async function editCommissionConfig(id){const r=await api('/admin/commission-config/list',{});const item=r.data?.list?.find(c=>c.id===id);if(!item){alert('Not found');return;}const body='<div style="line-height:2"><b>Level:</b> <input type="number" id="ccLevel" value="'+item.level+'" min="1" style="width:100px"><br><b>Rate (%):</b> <input type="number" id="ccRate" step="0.01" value="'+(item.rate*100)+'" style="width:200px"><br><b>Min Amount:</b> <input type="number" id="ccMin" step="0.01" value="'+item.min_amount+'" style="width:200px"><br><b>Max Amount:</b> <input type="number" id="ccMax" step="0.01" value="'+item.max_amount+'" style="width:200px"></div>';const footer='<button class="btn btn-accent" onclick="saveCommissionConfig('+id+')">Update</button><button class="btn" onclick="closeModal()">Cancel</button>';showModal('Edit Commission Config',body,footer);}
async function deleteCommissionConfig(id){if(!confirm('确认删除？'))return;const r=await api('/admin/commission-config/delete',{id});if(r.code===200){alert('[OK] Deleted');pgCommissionConfig();}else alert('[ERROR] '+r.msg);}
`;

if (!appJsContent.includes('async function pgGeneralConfig(')) {
  appJsContent += frontendFunctions;
  fs.writeFileSync(appJsFile, appJsContent, 'utf8');
  console.log('[3/3] Added frontend functions to admin-app.js');
} else {
  console.log('[3/3] Frontend functions already exist, skipping');
}

console.log('\n✅ All done! Configuration management module installed.');
console.log('👉 Restart the backend server to apply changes.');

# 工作日志 - Klakna Backend

## 2026-05-12 - Phase 1 路径匹配 Bug 修复

### 问题描述
多个 Phase 1 API 返回 `NOT_LOGIN` 错误，尽管已经实现了本地处理函数。

### 根本原因
`server.js` 中的路径匹配逻辑有缺陷：
1. `apiPath` 包含 `/exchange/` 前缀（如 `/exchange/RockieAiController/transfer`）
2. `localPrefixes` 数组中的条目有的是 `/RockieAiController/`，有的是 `/exchange/RockieAiController/`
3. 原有的匹配逻辑无法正确处理这种不一致

### 解决方案
修改 `server.js` 的路径匹配逻辑（约 line 394-400）：

```javascript
// 修复前（有bug）：
const checkPath = apiPath.charAt(0).toUpperCase() + apiPath.slice(1);
const needsLocal = localPrefixes.some(prefix => {
  const pLower = prefix.toLowerCase();
  return apiPath.startsWith(prefix) || apiPath.startsWith(pLower) ||
         checkPath.startsWith(prefix) || checkPath.startsWith(pLower);
});

// 修复后（正确）：
const cleanPath = apiPath.startsWith('/exchange/') ? apiPath.slice(9) : apiPath;
const cleanCheckPath = cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1);

const needsLocal = localPrefixes.some(prefix => {
  const pLower = prefix.toLowerCase();
  return cleanPath.startsWith(prefix) || cleanPath.startsWith(pLower) ||
         cleanCheckPath.startsWith(prefix) || cleanCheckPath.startsWith(pLower);
});
```

关键改进：
- 先剥离 `/exchange/` 前缀，得到纯净的路径
- 用纯净路径进行匹配，避免前缀不一致的问题

### 同步更新 `localPrefixes` 数组
在 `server.js` 的 `localPrefixes` 数组中（约 line 370-392），为所有 Phase 1 API 添加带 `/exchange/` 前缀的版本：

```javascript
const localPrefixes = [
  // ... 原有条目 ...
  
  // ===== Phase 1 新增 =====
  '/transfer/',
  '/largeTransactions',
  '/mobileWalletHistory',
  '/userAgreement',
  '/walletAccount',
  '/ws/',
  '/RockieAiController/',
  '/exchange/RockieAiController/',
  '/UserInfo',
  '/Wallet',
  '/exchange/UserInfo',
  '/exchange/Wallet',
  '/exchange/userAgreement',
  '/exchange/walletAccount',
];
```

### 验证结果
所有 Phase 1 API 现在正确返回本地响应：

| API 路径 | 响应状态 | 说明 |
|---------|---------|------|
| `/exchange/RockieAiController/transfer` | `{ code: 200, ... }` | ✅ 本地处理 |
| `/exchange/UserInfo` | `{ code: 200, data: {}, ... }` | ✅ 本地处理 |
| `/exchange/Wallet` | `{ code: 200, data: {}, ... }` | ✅ 本地处理 |
| `/exchange/walletAccount` | `{ code: 200, data: {}, ... }` | ✅ 本地处理 |
| `/exchange/userAgreement` | `{ code: 200, data: "", ... }` | ✅ 本地处理 |
| `/exchange/largeTransactions` | `{ code: 200, data: { content: { records: [] } }, ... }` | ✅ 本地处理 |
| `/exchange/mobileWalletHistory` | `{ code: 200, ... }` | ✅ 本地处理 |
| `/exchange/ws/user/queryUserUnreadList` | `{ code: 200, data: [], ... }` | ✅ 本地处理 |
| `/exchange/Transaction/new/stock` | `{ code: 200, ... }` | ✅ 本地处理 |

### PnL 计算验证
代码审查确认 PnL 计算正确使用实时价格：

**文件**: `routes/local-handlers.js`

1. **开仓** (`handleFuturesBuy`, line 510):
   ```javascript
   const openPrice = parseFloat(global.__priceCache[symbol]) || price;
   ```

2. **平仓** (`handleFuturesClose`, line 539):
   ```javascript
   const closePrice = parseFloat(global.__priceCache[symbol]) || price;
   const pnl = direction === 'buy' 
     ? (closePrice - openPrice) * amount 
     : (openPrice - closePrice) * amount;
   ```

3. **查询实时价格** (`handleGetPrice`, line 696):
   ```javascript
   const cached = global.__priceCache;
   // 返回所有币种的最新价格
   ```

### 遗留问题
- [ ] Phase 2 实际交易流程测试（需要前端交互）
- [ ] WebSocket 连接稳定性测试
- [ ] 大规模并发测试

### 提交信息
```
fix: 修复 Phase 1 API 路径匹配 bug

- 重写路径匹配逻辑，正确剥离 /exchange/ 前缀
- 更新 localPrefixes 数组，添加所有 Phase 1 API
- 验证 PnL 计算使用实时价格（global.__priceCache）
- 所有 Phase 1 API 现在正确返回本地响应

测试：
- ✅ /exchange/RockieAiController/transfer
- ✅ /exchange/UserInfo
- ✅ /exchange/Wallet
- ✅ /exchange/walletAccount
- ✅ /exchange/userAgreement
- ✅ /exchange/largeTransactions
- ✅ /exchange/mobileWalletHistory
- ✅ /exchange/ws/user/queryUserUnreadList
- ✅ /exchange/Transaction/new/stock
```

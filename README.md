# klakna-backend

Klakna crypto exchange backend - Express 5 + sql.js + WebSocket

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## 部署方式

点击上方 **Deploy to Render** 按钮，或手动：

1. Fork 此仓库
2. 在 Render Dashboard → New → Web Service
3. 连接仓库，选择 Free 计划
4. 点击 Create Web Service

## 环境变量（可选）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 8080 | 服务端口（Render 自动设置） |
| JWT_SECRET | klakna_backend_secret_key_2024 | JWT 密钥 |
| ADMIN_SECRET | klakna_admin_root_2024 | 管理员密钥 |
| DB_PATH | /tmp/klakna.db | 数据库路径 |
| TARGET_URL | https://www.klakna.sbs | 原站地址 |

## 本地运行

```bash
npm install
node server.js
```

#!/bin/bash
# 一键启动localtunnel并更新前端配置

echo "===== 启动 localtunnel ====="
cd "C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend"

# 启动localtunnel并保存到日志
npx localtunnel --port 8080 > /tmp/lt-current.log 2>&1 &
LT_PID=$!
echo "localtunnel 进程ID: $LT_PID"

# 等待获取URL
sleep 5

# 读取URL
LT_URL=$(grep "your url is:" /tmp/lt-current.log | head -1 | awk '{print $4}')
echo "获取到URL: $LT_URL"

if [ -z "$LT_URL" ]; then
  echo "❌ 无法获取localtunnel URL"
  exit 1
fi

echo ""
echo "===== 更新前端配置 ====="
cd "C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-github-pages"

# 更新index.html中的PROXY变量
sed -i "s|var PROXY = '.*';|var PROXY = '$LT_URL';|g" index.html

# 更新WebSocket URL
sed -i "s|url = url.replace('wss://cptmarketscoin-ctrl.github.io', 'wss://.*');|url = url.replace('wss://cptmarketscoin-ctrl.github.io', 'wss://${LT_URL#https://}');|g" index.html
sed -i "s|url = url.replace('ws://cptmarketscoin-ctrl.github.io', 'wss://.*');|url = url.replace('ws://cptmarketscoin-ctrl.github.io', 'wss://${LT_URL#https://}');|g" index.html

echo "✅ 已更新 index.html"
echo ""

echo "===== 推送到GitHub Pages ====="
git add index.html
git commit -m "fix: update API proxy to $LT_URL"
git push origin Folder

echo ""
echo "✅ 完成！"
echo "localtunnel URL: $LT_URL"
echo "前端已更新并推送到GitHub Pages"
echo "进程ID: $LT_PID (保持运行)"

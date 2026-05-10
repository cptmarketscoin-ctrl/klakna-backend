#!/bin/bash
# 启动 Cloudflare Tunnel 并保持运行

cd "C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend"

echo "[tunnel] Starting Cloudflare Tunnel..."

# 启动隧道，输出日志到文件
"${CLOUDFLARED:-C:/Users/Administrator/Downloads/cloudflared-windows-amd64.exe}" tunnel --url http://localhost:8080 --logfile /tmp/cf-tunnel.log --loglevel info &

TUNNEL_PID=$!
echo "[tunnel] PID: $TUNNEL_PID"

# 等待获取 URL
echo "[tunnel] Waiting for URL..."
for i in {1..30}; do
  if [ -f /tmp/cf-tunnel.log ]; then
    URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-tunnel.log | head -1)
    if [ -n "$URL" ]; then
      echo "[tunnel] URL: $URL"
      echo "$URL" > /tmp/cf-tunnel-url.txt
      break
    fi
  fi
  sleep 1
done

# 保持脚本运行，监控隧道状态
while kill -0 $TUNNEL_PID 2>/dev/null; do
  sleep 5
done

echo "[tunnel] Tunnel process exited, restarting in 3s..."
sleep 3
exec "$0"

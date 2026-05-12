#!/bin/bash
# Klakna Backend 一键部署脚本
# 使用方式: chmod +x deploy.sh && ./deploy.sh

set -e

echo "======================================"
echo "   Klakna Backend 部署脚本 v1.0"
echo "======================================"
echo ""

# 配置
APP_DIR="/home/klakna-backend"
LOG_FILE="$APP_DIR/deploy.log"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 开始部署
log "🚀 开始部署..."

cd $APP_DIR || exit 1

# 1. 停止旧进程
log "⏹️  停止旧进程..."
pm2 stop klakna-backend 2>/dev/null || true
pm2 delete klakna-backend 2>/dev/null || true

# 2. 拉取最新代码
log "📥 拉取最新代码..."
git fetch origin
git reset --hard origin/master
git pull origin master

# 3. 安装依赖
log "📦 安装依赖..."
npm install --production

# 4. 创建PM2配置（如果不存在）
if [ ! -f ecosystem.config.js ]; then
    log "📝 创建PM2配置..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'klakna-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
    mkdir -p logs
fi

# 5. 启动服务
log "🚀 启动PM2服务..."
pm2 start ecosystem.config.js

# 6. 保存PM2配置
pm2 save

# 7. 设置开机自启
pm2 startup

# 8. 检查状态
log "📊 服务状态:"
pm2 status

# 9. 检查端口
log "🌐 监听端口:"
netstat -tlnp 2>/dev/null | grep node || ss -tlnp | grep node

# 10. 测试API
sleep 2
if curl -s http://localhost:3000/api/config > /dev/null 2>&1; then
    log "✅ API测试通过!"
else
    log "⚠️ API测试失败，查看日志: pm2 logs klakna-backend"
fi

echo ""
echo "======================================"
echo "   部署完成!"
echo "======================================"
echo "查看日志: pm2 logs klakna-backend"
echo "重启服务: pm2 restart klakna-backend"
echo "======================================"

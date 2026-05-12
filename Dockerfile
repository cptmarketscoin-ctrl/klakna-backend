# 使用官方 Node.js 运行时作为父镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装 nodemon (开发环境使用)
RUN npm install -g nodemon

# 复制 package.json 和 package-lock.json (或 yarn.lock)
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 安装所有依赖 (包括开发依赖，用于构建)
RUN npm ci

# 复制应用源代码
COPY . .

# 生成 Prisma Client (如果使用 Prisma)
# RUN npx prisma generate

# 暴露端口 (根据你的应用修改)
EXPOSE 3000

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# 使用非 root 用户运行 (安全最佳实践)
# RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
# USER nodejs

# 启动应用
CMD ["node", "server.js"]

/**
 * PM2 Ecosystem Configuration
 * Optimized for stability and automatic recovery
 */

module.exports = {
  apps: [{
    name: 'klakna-backend',
    script: 'server.js',
    cwd: __dirname,
    
    // === Process Management ===
    instances: 1,                    // Single instance (stateless, can increase for cluster)
    exec_mode: 'fork',              // Fork mode (use 'cluster' for load balancing)
    watch: false,                    // Disable watch (use PM2 reload for updates)
    
    // === Auto Restart ===
    autorestart: true,               // Auto restart on crashes
    max_restarts: 10,               // Max restarts in 15 seconds
    min_uptime: '10s',              // Min uptime before considering restart valid
    max_memory_restart: '1G',       // Restart if memory exceeds 1GB
    
    // === Graceful Shutdown ===
    kill_timeout: 30000,             // Wait 30s for graceful shutdown
    listen_timeout: 10000,          // Timeout for listening on port
    shutdown_with_message: true,     // Send SIGTERM before SIGKILL
    
    // === Environment ===
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
      LOG_LEVEL: 'info'
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 8080,
      LOG_LEVEL: 'debug'
    },
    
    // === Logging ===
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,                // Merge logs from all instances
    time: true,                      // Prefix logs with timestamp
    
    // === Log Rotation ===
    // PM2 built-in log rotation (requires pm2-logrotate module)
    // Install: pm2 install pm2-logrotate
    // Config: pm2 set pm2-logrotate:max_size 10M
    
    // === Health Check ===
    // PM2 will check health endpoint before marking app as "online"
    // node-options: '--require ./health-check-wrapper.js',
    
    // === Resource Limits ===
    node_args: [
      '--max-old-space-size=1024',  // 1GB heap limit
      '--optimize-for-size'          // Optimize for memory efficiency
    ],
    
    // === Restart Delay ===
    restart_delay: 4000,             // Wait 4s before restart (prevent rapid restarts)
    
    // === PID File ===
    pid_file: 'logs/pm2.pid',
    
    // === Deep Monitoring (requires PM2 Plus) ===
    // deep_monitoring: true,
    
    // === PM2 Plus Features (optional) ===
    // vc_release: 'v1.0.0',
    // treek: 'my-app',
    // exec_interpreter: 'node',
  }],
  
  // === Deployment Configuration (optional) ===
  deploy: {
    production: {
      user: 'deploy',
      host: 'production-server.com',
      ref: 'origin/master',
      repo: 'git@github.com:username/klakna-backend.git',
      path: '/var/www/klakna-backend',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    },
    staging: {
      user: 'deploy',
      host: 'staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:username/klakna-backend.git',
      path: '/var/www/klakna-backend-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging'
    }
  }
};

/**
 * Usage:
 * 
 * # Start application
 * pm2 start ecosystem.config.js
 * 
 * # Start with specific environment
 * pm2 start ecosystem.config.js --env production
 * 
 * # Restart gracefully
 * pm2 reload ecosystem.config.js
 * 
 * # Stop application
 * pm2 stop ecosystem.config.js
 * 
 * # Delete from PM2 process list
 * pm2 delete klakna-backend
 * 
 * # View logs
 * pm2 logs klakna-backend
 * 
 * # Monitor
 * pm2 monit
 * 
 * # List all processes
 * pm2 list
 * 
 * # Save process list (for auto-start on boot)
 * pm2 save
 * 
 * # Setup auto-start on boot
 * pm2 startup
 * pm2 save
 * 
 * # Install log rotation
 * pm2 install pm2-logrotate
 * pm2 set pm2-logrotate:max_size 10M
 * pm2 set pm2-logrotate:retain 7
 */

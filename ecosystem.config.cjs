// PM2 进程管理配置：pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "dmk-progress",
      script: "dist/boot.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      out_file: "logs/out.log",
      error_file: "logs/err.log",
    },
  ],
};

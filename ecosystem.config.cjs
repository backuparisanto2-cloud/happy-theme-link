// pm2 config: menjalankan aplikasi + worker WhatsApp + penjadwal sebagai service.
//   npm install -g pm2 pm2-windows-startup
//   pm2-startup install
//   pm2 start ecosystem.config.cjs
//   pm2 save
module.exports = {
  apps: [
    {
      name: "wa-app",
      script: "scripts/start-server.mjs",
      env: { PORT: "3000", NODE_ENV: "production" },
      autorestart: true,
    },
    {
      name: "wa-worker",
      cwd: "./worker",
      script: "worker.js",
      autorestart: true,
    },
    {
      name: "wa-scheduler",
      cwd: "./worker",
      script: "scheduler.js",
      autorestart: true,
    },
  ],
};
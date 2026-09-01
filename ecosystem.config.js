module.exports = {
  apps: [
    {
      name: 'unclutterdesk-api',
      script: './apps/api/dist/src/main.js',
      cwd: '/home/unclutter/domains/app.unclutterdesk.com/app',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3050,
      },
    },
  ],
};

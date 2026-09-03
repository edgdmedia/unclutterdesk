module.exports = {
  apps: [
    {
      name: 'unclutterdesk-api',
      script: './apps/api/dist/src/main.js',
      cwd: '/home/unclutterdesk/app',

      // Stays at a single instance ON PURPOSE. The rate limiter uses
      // @nestjs/throttler's in-memory store, so each additional worker would get
      // its own counters and multiply every limit — including the auth limits.
      // Moving to cluster mode requires a shared throttler store (Redis) first.
      instances: 1,
      exec_mode: 'fork',

      // Restart policy. Without min_uptime/max_restarts a process that crashes
      // on boot restarts forever and the failure stays invisible.
      autorestart: true,
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 2000,
      max_memory_restart: '600M',

      // Give in-flight requests a chance to finish on reload/deploy.
      kill_timeout: 10000,
      listen_timeout: 10000,
      wait_ready: false,

      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      time: true,

      env_production: {
        NODE_ENV: 'production',
        PORT: 3050,
      },
    },
  ],
};

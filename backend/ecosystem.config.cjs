// file: Frontend/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'goodnumbers-web',
      script: './dist/server.js',
      exec_mode: 'fork',
      watch: false, // <-- CRITICAL: Turn this off
      ignore_watch: [], // This no longer has any effect
      // You can keep restart_delay for production resilience
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env_production: { NODE_ENV: 'production' },
      env_development: { NODE_ENV: 'development' },
    },
    {
      name: 'goodnumbers-worker',
      script: './dist/worker.js',
      exec_mode: 'fork',
      watch: false, // <-- CRITICAL: Turn this off
      ignore_watch: [],
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env_production: { NODE_ENV: 'production' },
      env_development: { NODE_ENV: 'development' },
    },
  ],
};

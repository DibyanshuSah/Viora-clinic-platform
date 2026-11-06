const path = require('path');

module.exports = {
  apps: [
    {
      name: 'viora-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DATABASE_URL: `file:${path.resolve(__dirname, 'prisma/viora.db').replace(/\\/g, '/')}`
      }
    }
  ]
};


const app = require('./app');
const { port } = require('./config/environment');

const PORT = port || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`  VIORA CLINIC MANAGEMENT BACKEND API   `);
  console.log(`  Running on http://localhost:${PORT}   `);
  console.log(`  API Base URL: http://localhost:${PORT}/api/v1 `);
  console.log(`=========================================`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

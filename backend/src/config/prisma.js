const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { assertNotProduction, PROD_DB_PATH, TEST_DB_PATH } = require('../utils/testDatabaseGuard');

// Compute absolute path to default SQLite database file
const defaultDbPath = process.env.NODE_ENV === 'test' ? TEST_DB_PATH : PROD_DB_PATH;
let rawUrl = process.env.DATABASE_URL;

if (!rawUrl || rawUrl.trim() === '') {
  rawUrl = process.env.NODE_ENV === 'test' ? 'file:./test_viora.db' : 'file:./viora.db';
}

let databaseUrl = rawUrl;

// Ensure relative SQLite URLs are always resolved relative to backend/prisma
if (
  rawUrl === 'file:./viora.db' ||
  rawUrl === 'file:./prisma/viora.db' ||
  rawUrl === 'file:./test_viora.db' ||
  rawUrl === 'file:./prisma/test_viora.db'
) {
  const targetPath = rawUrl.includes('test_viora.db') ? TEST_DB_PATH : PROD_DB_PATH;
  databaseUrl = `file:${targetPath.replace(/\\/g, '/')}`;
} else if (rawUrl.startsWith('file:') && !rawUrl.startsWith('file:/') && !rawUrl.match(/^file:[a-zA-Z]:/)) {
  const relativePart = rawUrl.replace(/^file:/, '');
  const resolved = path.resolve(__dirname, '../../prisma', relativePart);
  databaseUrl = `file:${resolved.replace(/\\/g, '/')}`;
}

// Safety Guard: In test environment, explicitly forbid connecting to production database
if (process.env.NODE_ENV === 'test') {
  const resolvedPath = databaseUrl.replace(/^file:/, '');
  assertNotProduction(resolvedPath);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

let isConfigured = false;
async function configureSqlitePragmas() {
  if (isConfigured) return;
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    isConfigured = true;
  } catch (err) {
    console.warn('[Prisma SQLite] Warning applying PRAGMAs:', err.message);
  }
}

// Apply Pragmas eagerly
configureSqlitePragmas().catch(() => {});

// Graceful process shutdown
process.on('SIGINT', async () => {
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(0);
});

process.on('SIGTERM', async () => {
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(0);
});

module.exports = prisma;

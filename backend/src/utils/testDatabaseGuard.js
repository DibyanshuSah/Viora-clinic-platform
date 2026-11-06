const path = require('path');
const fs = require('fs');

const PROD_DB_PATH = path.resolve(__dirname, '../../prisma/viora.db');
const TEST_DB_PATH = path.resolve(__dirname, '../../prisma/test_viora.db');

/**
 * Resolves any SQLite database URL to its absolute file path.
 */
function resolveDbPath(rawUrl) {
  const url = rawUrl || process.env.DATABASE_URL || 'file:./viora.db';
  if (url.startsWith('file:')) {
    const stripped = url.replace(/^file:/, '');
    if (path.isAbsolute(stripped) || stripped.match(/^[a-zA-Z]:/)) {
      return path.resolve(stripped);
    }
    return path.resolve(__dirname, '../../prisma', stripped);
  }
  return path.resolve(url);
}

/**
 * Throws a fatal safety error if the resolved database path is the production database.
 */
function assertNotProduction(resolvedPath) {
  const target = path.resolve(resolvedPath || resolveDbPath()).toLowerCase().replace(/\\/g, '/');
  const prod = PROD_DB_PATH.toLowerCase().replace(/\\/g, '/');

  if (target === prod) {
    throw new Error(
      `[CRITICAL SAFETY GUARD] BLOCKED: Test execution was attempted against the PRODUCTION database!\n` +
      `  Attempted DB: ${target}\n` +
      `  Production DB: ${prod}\n` +
      `  Tests MUST run against an isolated test database (e.g. test_viora.db).`
    );
  }
}

/**
 * Prepares a fresh isolated test database by copying baseline seed data and running migrations.
 */
function setupTestDatabase(options = {}) {
  const testDbFile = options.dbPath || TEST_DB_PATH;
  assertNotProduction(testDbFile);

  const prismaDir = path.resolve(__dirname, '../../prisma');
  const prodDbFile = path.join(prismaDir, 'viora.db');

  // Clean existing test DB files including WAL/SHM
  cleanTestDatabase(testDbFile);

  // Copy production schema/baseline into test DB
  if (fs.existsSync(prodDbFile)) {
    fs.copyFileSync(prodDbFile, testDbFile);
  } else {
    throw new Error(`Production baseline file not found at ${prodDbFile}`);
  }

  // Ensure test baseline includes doctors and credentials needed for end-to-end tests
  try {
    const { execSync } = require('child_process');
    const backendDir = path.resolve(__dirname, '../..');
    const normalizedUrl = `file:${testDbFile.replace(/\\/g, '/')}`;
    execSync(`node prisma/seed.js`, {
      cwd: backendDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: normalizedUrl
      },
      stdio: 'pipe'
    });
  } catch (err) {
    console.warn('[testDatabaseGuard] Note on test db seed:', err.message);
  }

  return testDbFile;
}

/**
 * Safely removes test database and associated journal/WAL/SHM files.
 */
function cleanTestDatabase(testDbFile = TEST_DB_PATH) {
  assertNotProduction(testDbFile);

  const targets = [
    testDbFile,
    `${testDbFile}-journal`,
    `${testDbFile}-wal`,
    `${testDbFile}-shm`
  ];

  for (const f of targets) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch (err) {
        // Retry shortly if file locked
        try {
          const timeout = Date.now() + 1000;
          while (Date.now() < timeout && fs.existsSync(f)) {
            try { fs.unlinkSync(f); break; } catch {}
          }
        } catch {}
      }
    }
  }
}

module.exports = {
  PROD_DB_PATH,
  TEST_DB_PATH,
  resolveDbPath,
  assertNotProduction,
  setupTestDatabase,
  cleanTestDatabase
};

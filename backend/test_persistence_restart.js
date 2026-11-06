/**
 * Task 5: True Process-Isolated Persistence and Restart Test
 * 
 * Replaces the in-process require.cache restart simulation.
 * Spawns Process A and Process B as separate OS processes via child_process.spawn.
 * - Process A: Creates records in isolated test DB, commits, disconnects, exits.
 * - Process B: Starts in a new OS process, independently connects to the same test DB,
 *              verifies all records created by Process A.
 * - Confirms PID A !== PID B.
 * - Confirms production database is never touched.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test_persist_viora.db';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { setupTestDatabase, cleanTestDatabase, assertNotProduction, PROD_DB_PATH } = require('./src/utils/testDatabaseGuard');

const testDbPath = path.resolve(__dirname, 'prisma/test_persist_viora.db');
const checkpointPath = path.resolve(__dirname, 'prisma/test_persist_checkpoint.json');

// Safety guard
assertNotProduction(testDbPath);

function spawnProcess(phase) {
  return new Promise((resolve, reject) => {
    const workerScript = path.resolve(__dirname, 'test_persistence_worker.js');
    const child = spawn(
      process.execPath,
      [
        workerScript,
        `--phase=${phase}`,
        `--db=${testDbPath}`,
        `--checkpoint=${checkpointPath}`
      ],
      {
        cwd: __dirname,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: `file:${testDbPath.replace(/\\/g, '/')}`
        },
        stdio: 'inherit'
      }
    );

    const pid = child.pid;

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ pid, code });
      } else {
        reject(new Error(`Process ${phase} exited with non-zero exit code: ${code}`));
      }
    });
  });
}

async function runProcessIsolatedPersistenceTest() {
  console.log('================================================================');
  console.log('  TASK 5: TRUE PROCESS-ISOLATED DATA PERSISTENCE & RESTART TEST ');
  console.log('  [SEPARATE OS PROCESS SPAWN ARCHITECTURE]                      ');
  console.log('================================================================\n');

  console.log(`[Safety Guard] Isolated test DB initialized at: ${testDbPath}`);
  setupTestDatabase({ dbPath: testDbPath });

  // Phase 1: Spawn OS Process A
  console.log('Launching Process A (Pre-Restart / Creation Phase)...');
  const resA = await spawnProcess('create');
  console.log(`✓ Process A completed successfully with OS PID: ${resA.pid}\n`);

  // Phase 2: Spawn OS Process B
  console.log('Launching Process B (Post-Restart / Verification Phase in new OS process)...');
  const resB = await spawnProcess('verify');
  console.log(`✓ Process B completed successfully with OS PID: ${resB.pid}\n`);

  // Verify PID isolation
  console.log('--- PROCESS ISOLATION VERIFICATION ---');
  console.log(`  Process A PID: ${resA.pid}`);
  console.log(`  Process B PID: ${resB.pid}`);
  assert.notStrictEqual(resA.pid, resB.pid, 'Process A and Process B must run with different OS PIDs');
  console.log(`✓ Process Isolation Confirmed: PID ${resA.pid} !== PID ${resB.pid} (Distinct OS processes!)\n`);

  // Safety Verification: Production DB is untouched
  console.log('[Safety Verification] Checking production database...');
  const prodClient = new PrismaClient({
    datasources: { db: { url: `file:${PROD_DB_PATH.replace(/\\/g, '/')}` } }
  });
  try {
    const prodPatients = await prodClient.patient.count();
    const prodBills = await prodClient.bill.count();
    assert.strictEqual(prodPatients, 0, 'Production DB must contain ZERO test patients');
    assert.strictEqual(prodBills, 0, 'Production DB must contain ZERO test bills');
    console.log('✓ Production database verified completely untouched: 0 test patients, 0 test bills.\n');
  } finally {
    await prodClient.$disconnect();
  }

  // Clean up
  cleanTestDatabase(testDbPath);
  if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);

  console.log('================================================================');
  console.log('  🎯 TASK 5 PROCESS-ISOLATED PERSISTENCE TEST PASSED 100%!       ');
  console.log('================================================================\n');
}

runProcessIsolatedPersistenceTest().catch((err) => {
  console.error('❌ Persistence test failed:', err);
  cleanTestDatabase(testDbPath);
  if (fs.existsSync(checkpointPath)) {
    try { fs.unlinkSync(checkpointPath); } catch {}
  }
  process.exit(1);
});

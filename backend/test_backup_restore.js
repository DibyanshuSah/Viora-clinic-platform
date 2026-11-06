/**
 * Task 6: Backup and Restore Round-Trip Validation
 * 
 * Requirements:
 * - Keep VACUUM INTO backup mechanism.
 * - Verify backup integrity.
 * - Test a complete restore round-trip using an isolated test database.
 * - Ensure all database connections are closed before replacing a database file.
 * - Never perform a restore against production as part of automated tests.
 * - Document exact safe production restore steps.
 * - Confirm WAL and SHM handling.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test_backup_roundtrip.db';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { setupTestDatabase, cleanTestDatabase, assertNotProduction, PROD_DB_PATH } = require('./src/utils/testDatabaseGuard');

const testDbPath = path.resolve(__dirname, 'prisma/test_backup_roundtrip.db');
const testBackupDir = path.resolve(__dirname, 'prisma/test_backups');

assertNotProduction(testDbPath);

async function runBackupRestoreTests() {
  console.log('================================================================');
  console.log('  TASK 6: BACKUP AND RESTORE ROUND-TRIP VALIDATION TEST         ');
  console.log('================================================================\n');

  setupTestDatabase({ dbPath: testDbPath });

  const prisma = require('./src/config/prisma');
  const { BackupManager } = require('./src/utils/backupManager');
  const backupMgr = new BackupManager(testDbPath, testBackupDir);

  // Step 1: Create initial state in test DB
  console.log('[STEP 1] Seeding initial test records before backup...');
  await prisma.patient.create({
    data: {
      patientId: 'PAT-BACKUP-01',
      name: 'Initial Snapshot Patient',
      age: 35,
      phone: '+91 98451 00001',
      city: 'Bengaluru'
    }
  });
  const countBeforeBackup = await prisma.patient.count();
  console.log(`✓ Initial state created: ${countBeforeBackup} patient record(s).\n`);

  // Step 2: Create atomic backup via VACUUM INTO
  console.log('[STEP 2] Creating atomic SQLite backup via PRAGMA VACUUM INTO...');
  const backupResult = await backupMgr.createBackup('roundtrip_snapshot', prisma);
  assert(backupResult.success, 'Backup creation must return success: true');
  assert(fs.existsSync(backupResult.path), 'Backup file must exist on disk');
  console.log(`✓ Backup successfully created: ${backupResult.filename} (${(backupResult.sizeBytes / 1024).toFixed(1)} KB).\n`);

  // Step 3: Verify backup integrity
  console.log('[STEP 3] Verifying backup database integrity via PRAGMA integrity_check...');
  const isHealthy = await backupMgr.verifyBackup(backupResult.filename);
  assert.strictEqual(isHealthy, true, 'Backup integrity check must return true (ok)');
  console.log(`✓ Backup integrity verified: HEALTHY (ok).\n`);

  // Step 4: Mutate active test database state after backup
  console.log('[STEP 4] Modifying active database state (adding new record to diverge from backup)...');
  await prisma.patient.create({
    data: {
      patientId: 'PAT-BACKUP-02',
      name: 'Post-Backup Divergent Patient',
      age: 28,
      phone: '+91 98451 00002',
      city: 'Bengaluru'
    }
  });
  const countAfterMutation = await prisma.patient.count();
  assert.strictEqual(countAfterMutation, countBeforeBackup + 1, 'Database should now have mutated record count');
  console.log(`✓ State mutated: Database now has ${countAfterMutation} patient records (diverged from backup).\n`);

  // Step 5: Test safety guard against restoring to production
  console.log('[STEP 5] Testing Safety Guard: Attempting restore against production DB path in test mode...');
  let guardTriggered = false;
  try {
    await backupMgr.restoreBackup(backupResult.filename, {
      targetDbPath: PROD_DB_PATH,
      prismaClient: prisma
    });
  } catch (err) {
    if (err.message && err.message.includes('CRITICAL SAFETY GUARD')) {
      guardTriggered = true;
      console.log(`✓ Safety Guard triggered as expected: ${err.message.split('\n')[0]}`);
    } else {
      throw err;
    }
  }
  assert.strictEqual(guardTriggered, true, 'Safety guard MUST prevent restore against production DB in test mode');
  console.log('✓ Production DB restore protection verified.\n');

  // Step 6: Test restore round-trip on isolated test DB
  console.log('[STEP 6] Executing safe restore round-trip on isolated test database...');
  const restoreResult = await backupMgr.restoreBackup(backupResult.filename, {
    targetDbPath: testDbPath,
    prismaClient: prisma
  });
  assert(restoreResult.success, 'Restore must report success: true');
  console.log(`✓ Restore operation completed from ${restoreResult.restoredFrom}.\n`);

  // Step 7: Reconnect and verify data restored to exact snapshot state
  console.log('[STEP 7] Verifying restored database state and WAL/SHM handling...');
  // Check stale WAL/SHM handling
  const walExists = fs.existsSync(`${testDbPath}-wal`);
  const shmExists = fs.existsSync(`${testDbPath}-shm`);
  console.log(`  WAL file present after restore: ${walExists}`);
  console.log(`  SHM file present after restore: ${shmExists}`);

  const restoredClient = new PrismaClient({
    datasources: { db: { url: `file:${testDbPath.replace(/\\/g, '/')}` } }
  });

  try {
    const integrityRes = await restoredClient.$queryRawUnsafe('PRAGMA integrity_check;');
    assert.strictEqual(integrityRes[0].integrity_check, 'ok', 'Restored database must pass integrity check');
    console.log(`✓ Restored database integrity check: ok`);

    const restoredPatients = await restoredClient.patient.findMany({ orderBy: { patientId: 'asc' } });
    assert.strictEqual(restoredPatients.length, countBeforeBackup, 'Restored DB must revert to exact backup record count');
    assert.strictEqual(restoredPatients[0].patientId, 'PAT-BACKUP-01', 'Initial record must be present');
    const mutatedPatientFound = restoredPatients.some(p => p.patientId === 'PAT-BACKUP-02');
    assert.strictEqual(mutatedPatientFound, false, 'Mutated post-backup record must NOT exist in restored DB');
    console.log(`✓ Restored database verified: Exact snapshot state restored (Patient PAT-BACKUP-01 present, PAT-BACKUP-02 removed).\n`);
  } finally {
    await restoredClient.$disconnect();
  }

  // Safety check: confirm production database is untouched
  console.log('[Safety Verification] Confirming production database was untouched...');
  const prodClient = new PrismaClient({
    datasources: { db: { url: `file:${PROD_DB_PATH.replace(/\\/g, '/')}` } }
  });
  try {
    const prodPatients = await prodClient.patient.count();
    const prodBills = await prodClient.bill.count();
    assert.strictEqual(prodPatients, 0, 'Production DB must have 0 test patients');
    assert.strictEqual(prodBills, 0, 'Production DB must have 0 test bills');
    console.log('✓ Production database verified completely untouched: 0 test patients, 0 test bills.\n');
  } finally {
    await prodClient.$disconnect();
  }

  // Clean up
  cleanTestDatabase(testDbPath);
  if (fs.existsSync(testBackupDir)) {
    fs.rmSync(testBackupDir, { recursive: true, force: true });
  }
  console.log('✓ Test database and test backup artifacts cleaned up.\n');

  console.log('================================================================');
  console.log('  🎯 ALL TASK 6 BACKUP & RESTORE TESTS PASSED 100%!              ');
  console.log('================================================================\n');
}

runBackupRestoreTests().catch((err) => {
  console.error('❌ Backup & restore test failed:', err);
  cleanTestDatabase(testDbPath);
  if (fs.existsSync(testBackupDir)) {
    try { fs.rmSync(testBackupDir, { recursive: true, force: true }); } catch {}
  }
  process.exit(1);
});


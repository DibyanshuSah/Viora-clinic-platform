/**
 * Task 2: Concurrency Test for Atomic ID Generation
 * Tests at least 50 simultaneous ID allocations for all 9 entities:
 * PAT, DOC, STF, PROC, APT, CNS, RX, BILL, INV
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test_concurrency.db';

const assert = require('assert');
const path = require('path');
const { setupTestDatabase, cleanTestDatabase, assertNotProduction } = require('./src/utils/testDatabaseGuard');

const testDbPath = path.resolve(__dirname, 'prisma/test_concurrency.db');
assertNotProduction(testDbPath);

async function runConcurrencyTests() {
  console.log('================================================================');
  console.log('  TASK 2: ATOMIC ID GENERATION CONCURRENCY & UNIQUENESS TEST   ');
  console.log('================================================================\n');

  setupTestDatabase({ dbPath: testDbPath });

  // Load Prisma client configured for test DB
  const prisma = require('./src/config/prisma');
  const idGenerator = require('./src/utils/idGenerator');

  const CONCURRENCY_COUNT = 50;
  const entities = ['PAT', 'DOC', 'STF', 'PROC', 'APT', 'CNS', 'RX', 'BILL', 'INV'];

  const results = {};

  for (const entity of entities) {
    process.stdout.write(`Testing concurrency for ${entity} (${CONCURRENCY_COUNT} simultaneous requests)... `);
    const start = Date.now();

    let generatorFn;
    switch (entity) {
      case 'PAT': generatorFn = () => idGenerator.nextPatientId(); break;
      case 'DOC': generatorFn = () => idGenerator.nextDoctorId(); break;
      case 'STF': generatorFn = () => idGenerator.nextStaffId(); break;
      case 'PROC': generatorFn = () => idGenerator.nextProcedureId(); break;
      case 'APT': generatorFn = () => idGenerator.nextAppointmentId(); break;
      case 'CNS': generatorFn = () => idGenerator.nextConsultationId(); break;
      case 'RX': generatorFn = () => idGenerator.nextPrescriptionId(); break;
      case 'BILL': generatorFn = async () => (await idGenerator.nextBillId()).billId; break;
      case 'INV': generatorFn = () => idGenerator.nextInvoiceNumber(); break;
      default: throw new Error(`Unknown entity: ${entity}`);
    }

    // Launch 50 simultaneous allocation requests
    const promises = Array.from({ length: CONCURRENCY_COUNT }, () => generatorFn());
    const allocatedIds = await Promise.all(promises);

    const elapsed = Date.now() - start;

    // Verify all returned IDs are unique
    const uniqueIds = new Set(allocatedIds);
    assert.strictEqual(
      uniqueIds.size,
      CONCURRENCY_COUNT,
      `Duplicate IDs detected for ${entity}! Got ${uniqueIds.size} unique out of ${CONCURRENCY_COUNT}`
    );

    results[entity] = {
      count: allocatedIds.length,
      uniqueCount: uniqueIds.size,
      sampleFirst: allocatedIds[0],
      sampleLast: allocatedIds[allocatedIds.length - 1],
      elapsedMs: elapsed
    };

    console.log(`PASS (${elapsed}ms, 100% unique: ${allocatedIds[0]} ... ${allocatedIds[allocatedIds.length - 1]})`);
  }

  console.log('\n--- ID SEQUENCE COUNTER RECORDS IN DATABASE ---');
  const counterRows = await prisma.idSequence.findMany({ orderBy: { name: 'asc' } });
  for (const row of counterRows) {
    console.log(`  Counter: ${row.name.padEnd(8)} | Current Value: ${row.currentVal} | Updated: ${row.updatedAt.toISOString()}`);
  }

  // Verify dedicated counter records exist for all 9 entities
  for (const entity of entities) {
    const found = counterRows.some(r => r.name === entity);
    assert(found, `Dedicated counter record for ${entity} must exist in id_sequences`);
  }

  console.log('\n================================================================');
  console.log('  🎯 ALL 9 ENTITIES PASSED CONCURRENCY & UNIQUENESS VALIDATION!  ');
  console.log('================================================================\n');

  await prisma.$disconnect();
  cleanTestDatabase(testDbPath);
}

runConcurrencyTests().catch(async (err) => {
  console.error('❌ Concurrency test failed:', err);
  cleanTestDatabase(testDbPath);
  process.exit(1);
});


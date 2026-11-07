/**
 * Phase 3 Verification Test Suite
 * Strictly runs against an ISOLATED test database (test_phase3_verification.db).
 * Asserts production database is never touched.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test_phase3_verification.db';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { setupTestDatabase, cleanTestDatabase, assertNotProduction, PROD_DB_PATH } = require('./src/utils/testDatabaseGuard');

const testDbPath = path.resolve(__dirname, 'prisma/test_phase3_verification.db');

// Ensure safety guard triggers immediately if mistakenly pointed to production
assertNotProduction(testDbPath);

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('  PHASE 3: BACKEND VERIFICATION & SAFETY TEST SUITE              ');
  console.log('================================================================\n');

  console.log(`[Safety Check] Setting up isolated test DB: ${path.basename(testDbPath)}`);
  setupTestDatabase({ dbPath: testDbPath });

  // Load backend services and prisma
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${testDbPath.replace(/\\/g, '/')}` } }
  });
  
  // Wire test client into services
  const patientService = require('./src/services/patientService');
  const doctorService = require('./src/services/doctorService');
  const staffService = require('./src/services/staffService');
  const billingService = require('./src/services/billingService');

  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    passed++;
    console.log(`  ✔ PASS: ${testName}`);
  }

  function recordFail(testName, err) {
    failed++;
    console.error(`  ❌ FAIL: ${testName}`, err.message);
  }

  // -------------------------------------------------------------
  // TEST 1: PATIENT ARCHIVAL LIFECYCLE
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Safe Patient Archival ---');
  try {
    // 1a. Create synthetic patient
    const testPatient = await patientService.createPatient({
      name: 'Test Synthetic Patient',
      age: 35,
      gender: 'Male',
      phone: '+919999988888',
      whatsappNumber: '+919999988888',
      city: 'Bengaluru',
      state: 'Karnataka'
    });
    assert.strictEqual(testPatient.status, 'Active', 'New patient must default to Active status');
    recordPass('Synthetic patient created with status: Active');

    // 1b. Verify appears in default operational list
    let activePatients = await patientService.getAllPatients();
    assert(activePatients.some(p => p.patientId === testPatient.patientId), 'Active patient must appear in operational list');
    recordPass('Active patient is visible in operational list');

    // 1c. Create appointment and bill for this patient
    await prisma.appointment.create({
      data: {
        appointmentId: 'APT-TEST-001',
        patientId: testPatient.patientId,
        doctorId: 'DOC-101',
        date: '2026-11-10',
        time: '10:00',
        status: 'Scheduled'
      }
    });

    await prisma.bill.create({
      data: {
        billId: 'BIL-TEST-001',
        invoiceNumber: 'INV-TEST-001',
        patientId: testPatient.patientId,
        doctorId: 'DOC-101',
        appointmentId: 'APT-TEST-001',
        consultationType: 'General Consultation',
        subtotal: 500,
        total: 500,
        paid: 500,
        balance: 0,
        invoiceStatus: 'Paid'
      }
    });

    // 1d. Archive the patient
    const archiveResult = await patientService.archivePatient(testPatient.patientId);
    assert.strictEqual(archiveResult.message, 'Patient archived successfully');
    assert.strictEqual(archiveResult.patient.status, 'Archived');
    recordPass('Patient successfully archived via archivePatient()');

    // 1e. Verify patient is excluded from normal operational list
    activePatients = await patientService.getAllPatients();
    assert(!activePatients.some(p => p.patientId === testPatient.patientId), 'Archived patient must NOT appear in normal operational list');
    recordPass('Archived patient is successfully excluded from normal operational list');

    // 1f. Verify patient IS included when includeArchived=true
    const allPatientsWithArchived = await patientService.getAllPatients('', { includeArchived: true });
    assert(allPatientsWithArchived.some(p => p.patientId === testPatient.patientId), 'Archived patient must be retrievable when includeArchived=true');
    recordPass('Archived patient is retrievable when includeArchived=true');

    // 1g. Verify getPatientById still returns complete clinical and billing history
    const patientDetails = await patientService.getPatientById(testPatient.patientId);
    assert.strictEqual(patientDetails.patientId, testPatient.patientId);
    assert.strictEqual(patientDetails.status, 'Archived');
    assert.strictEqual(patientDetails.appointments.length, 1, 'Appointments must remain intact');
    assert.strictEqual(patientDetails.bills.length, 1, 'Bills must remain intact');
    recordPass('Historical clinical & billing records remain intact and accessible via getPatientById()');

    // 1h. Verify pending appointment was safely cancelled
    const updatedApt = await prisma.appointment.findUnique({ where: { appointmentId: 'APT-TEST-001' } });
    assert.strictEqual(updatedApt.status, 'Cancelled', 'Scheduled appointments should be cancelled when patient is archived');
    recordPass('Pending appointments safely cancelled upon patient archival');

    // 1i. Verify repeated archival is idempotent
    const repeatArchive = await patientService.archivePatient(testPatient.patientId);
    assert.strictEqual(repeatArchive.message, 'Patient is already archived');
    recordPass('Repeated archival request handled idempotently');

  } catch (err) {
    recordFail('Patient Archival Lifecycle', err);
  }

  // -------------------------------------------------------------
  // TEST 2: STAFF ORPHAN RELATIONSHIP & DEACTIVATION
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Staff Orphan Relationship Handling ---');
  try {
    // 2a. Test staff with valid linked user
    const resValid = await staffService.deleteStaff('STF-201');
    assert.strictEqual(resValid.status, 'Inactive');
    const stfValid = await prisma.staff.findUnique({ where: { staffId: 'STF-201' } });
    assert.strictEqual(stfValid.status, 'Inactive');
    const usrValid = await prisma.user.findUnique({ where: { id: 'usr-staff-1' } });
    assert.strictEqual(usrValid.status, 'Inactive');
    recordPass('Staff with valid linked user deactivates both staff and user records');

    // 2b. Test staff STF-203 with missing linked user (usr-staff-3)
    const resOrphan = await staffService.deleteStaff('STF-203');
    assert.strictEqual(resOrphan.status, 'Inactive');
    assert(resOrphan.warning && resOrphan.warning.includes('usr-staff-3'), 'Must report warning regarding missing user');
    const stfOrphan = await prisma.staff.findUnique({ where: { staffId: 'STF-203' } });
    assert.strictEqual(stfOrphan.status, 'Inactive', 'Staff record must be deactivated');
    assert.strictEqual(stfOrphan.userId, 'usr-staff-3', 'Staff record must preserve original userId reference');
    recordPass('Staff STF-203 with orphaned user reference deactivates safely without P2025 error');

  } catch (err) {
    recordFail('Staff Orphan Deactivation', err);
  }

  // -------------------------------------------------------------
  // TEST 3: INACTIVE DOCTOR & STAFF FILTERING
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Inactive Doctor & Staff Filtering ---');
  try {
    // 3a. Staff filtering
    const activeStaff = await staffService.getAllStaff();
    assert(activeStaff.every(s => s.status === 'Active'), 'Default getAllStaff() must only return Active staff');
    recordPass('Default getAllStaff() returns only Active staff');

    const allStaff = await staffService.getAllStaff({ includeInactive: true });
    assert(allStaff.some(s => s.status === 'Inactive'), 'getAllStaff({ includeInactive: true }) must include Inactive staff');
    recordPass('getAllStaff({ includeInactive: true }) returns inactive staff for Admin');

    // 3b. Doctor deactivation & filtering
    await doctorService.deleteDoctor('DOC-101');
    const activeDoctors = await doctorService.getAllDoctors();
    assert(!activeDoctors.some(d => d.doctorId === 'DOC-101'), 'Deactivated doctor must NOT appear in default getAllDoctors()');
    recordPass('Deactivated doctor is excluded from default getAllDoctors()');

    const allDoctors = await doctorService.getAllDoctors({ includeInactive: true });
    assert(allDoctors.some(d => d.doctorId === 'DOC-101' && d.status === 'Inactive'), 'Deactivated doctor must appear when includeInactive=true');
    recordPass('Deactivated doctor is retrievable when includeInactive=true');

  } catch (err) {
    recordFail('Doctor & Staff Filtering', err);
  }

  // -------------------------------------------------------------
  // TEST 4: INVOICE CANCELLATION TERMINOLOGY & PRESERVATION
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Invoice Cancellation & Preservation ---');
  try {
    // Create patient and bills
    const billPatient = await patientService.createPatient({
      name: 'Billing Test Patient',
      age: 40,
      phone: '+919876543210'
    });

    await prisma.bill.create({
      data: {
        billId: 'BIL-CANCEL-001',
        invoiceNumber: 'INV-CAN-001',
        patientId: billPatient.patientId,
        doctorId: 'DOC-101',
        consultationType: 'General Consultation',
        subtotal: 1200,
        total: 1200,
        paid: 0,
        balance: 1200,
        invoiceStatus: 'Unpaid'
      }
    });

    // Execute cancellation
    const cancelRes = await billingService.deletePatientTotalBills(billPatient.patientId);
    assert.strictEqual(cancelRes.cancelledCount, 1, 'Response must provide cancelledCount');
    assert.strictEqual(cancelRes.deletedCount, 1, 'Response must provide deletedCount for backward compatibility');
    assert(cancelRes.message.includes('cancelled'), 'Message must indicate cancellation');
    recordPass('Billing response provides cancelledCount, deletedCount, and cancellation message');

    // Verify row still exists in SQLite table
    const preservedBill = await prisma.bill.findUnique({ where: { billId: 'BIL-CANCEL-001' } });
    assert(preservedBill !== null, 'Invoice row must NOT be deleted from the database');
    assert.strictEqual(preservedBill.invoiceStatus, 'Cancelled', 'Invoice status must be Cancelled');
    recordPass('Invoice row physically preserved in SQLite database with status = Cancelled');

  } catch (err) {
    recordFail('Invoice Cancellation', err);
  }

  // -------------------------------------------------------------
  // TEST 5: DATABASE INTEGRITY & RESOLUTION
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Database Integrity & Path Resolution ---');
  try {
    const integrityCheck = await prisma.$queryRawUnsafe('PRAGMA integrity_check;');
    assert.strictEqual(integrityCheck[0].integrity_check, 'ok', 'Database integrity check must return ok');
    recordPass('SQLite PRAGMA integrity_check returned ok');

    // Disconnect test client
    await prisma.$disconnect();

    // Clean test database
    cleanTestDatabase(testDbPath);
    recordPass('Test database cleaned up cleanly');

  } catch (err) {
    recordFail('Database Integrity', err);
  }

  console.log('\n================================================================');
  console.log(`  PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch(err => {
  console.error('[FATAL TEST ERROR]', err);
  process.exit(1);
});

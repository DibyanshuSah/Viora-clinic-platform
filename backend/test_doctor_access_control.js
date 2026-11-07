/**
 * Doctor Access Control Integration Test
 * Tests that doctor-scoped access enforcement works correctly server-side.
 * Uses isolated test DB — never touches production viora.db.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// ─── Isolated Test DB ─────────────────────────────────────────────────────────
const TEST_DB = path.join(__dirname, 'test_doctor_access.db');
process.env.DATABASE_URL = `file:${TEST_DB}`;

// Copy production schema to test DB
const prodDb = path.join(__dirname, 'prisma', 'viora.db');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

// Bootstrap schema using Python sqlite3
const pyCode = `
import sqlite3, shutil
shutil.copy(r'${prodDb.replace(/\\/g, '\\\\')}', r'${TEST_DB.replace(/\\/g, '\\\\')}')
conn = sqlite3.connect(r'${TEST_DB.replace(/\\/g, '\\\\')}')
conn.execute("PRAGMA journal_mode=WAL")
# Remove all data for clean test state
conn.execute("DELETE FROM appointments")
conn.execute("DELETE FROM consultations")
conn.execute("DELETE FROM prescriptions")
conn.execute("DELETE FROM bills")
conn.execute("DELETE FROM bill_access_links")
conn.execute("DELETE FROM whatsapp_messages")
conn.execute("DELETE FROM patients")
conn.execute("DELETE FROM doctors WHERE doctorId NOT IN ('DOC-TEST-A','DOC-TEST-B')")
conn.execute("DELETE FROM users WHERE id NOT IN ('usr-test-docA','usr-test-docB','usr-test-admin','usr-test-staff')")
conn.execute("DELETE FROM doctors")
conn.execute("DELETE FROM users")
conn.execute("DELETE FROM patients")
conn.commit()
conn.close()
print("OK")
`;
execFileSync('python', ['-c', pyCode]);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${TEST_DB}` } },
  log: ['error']
});

// ─── Test State ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function pass(msg) { console.log(`  ✔ PASS: ${msg}`); passed++; }
function fail(msg, err) { console.log(`  ✘ FAIL: ${msg}`); if (err) console.log('    ', err?.message || err); failed++; }

// ─── Test Helpers ─────────────────────────────────────────────────────────────
const patientService = require('./src/services/patientService');
const consultationService = require('./src/services/consultationService');
const prescriptionService = require('./src/services/prescriptionService');

// Mock user objects (simulate req.user from JWT)
const userDocA = { id: 'usr-docA', role: 'DOCTOR', referenceId: 'DOC-TEST-A', name: 'Doctor A' };
const userDocB = { id: 'usr-docB', role: 'DOCTOR', referenceId: 'DOC-TEST-B', name: 'Doctor B' };
const userAdmin = { id: 'usr-admin-1', role: 'ADMIN', referenceId: null, name: 'Admin' };
const userStaff = { id: 'usr-staff-1', role: 'STAFF', referenceId: 'STF-001', name: 'Staff' };

// ─── Setup ────────────────────────────────────────────────────────────────────
async function setup() {
  // Create two test doctors
  await prisma.doctor.createMany({
    data: [
      { doctorId: 'DOC-TEST-A', userId: 'usr-docA', name: 'Doctor Alpha', specialization: 'General', phone: '1111111111', email: 'docA@test.com', status: 'Active', consultationRates: '{}', procedureRates: '{}', workingDays: '[]', workingHours: '{}', breakTimes: '{}' },
      { doctorId: 'DOC-TEST-B', userId: 'usr-docB', name: 'Doctor Beta', specialization: 'General', phone: '2222222222', email: 'docB@test.com', status: 'Active', consultationRates: '{}', procedureRates: '{}', workingDays: '[]', workingHours: '{}', breakTimes: '{}' }
    ]
  });

  // Create 3 test patients
  await prisma.patient.createMany({
    data: [
      { patientId: 'TEST-PAT-1', name: 'Patient One', phone: '9000000001', age: 30, gender: 'Male', status: 'Active' },
      { patientId: 'TEST-PAT-2', name: 'Patient Two', phone: '9000000002', age: 25, gender: 'Female', status: 'Active' },
      { patientId: 'TEST-PAT-3', name: 'Patient Three', phone: '9000000003', age: 40, gender: 'Male', status: 'Active' }
    ]
  });

  // Assign Patient 1 and 2 to Doctor A via appointments
  await prisma.appointment.createMany({
    data: [
      { appointmentId: 'APT-TEST-1', patientId: 'TEST-PAT-1', doctorId: 'DOC-TEST-A', date: '2026-11-07', time: '09:00', appointmentType: 'Consultation', status: 'Completed' },
      { appointmentId: 'APT-TEST-2', patientId: 'TEST-PAT-2', doctorId: 'DOC-TEST-A', date: '2026-11-07', time: '10:00', appointmentType: 'Consultation', status: 'Completed' }
    ]
  });

  // Assign Patient 3 to Doctor B via appointment
  await prisma.appointment.create({
    data: { appointmentId: 'APT-TEST-3', patientId: 'TEST-PAT-3', doctorId: 'DOC-TEST-B', date: '2026-11-07', time: '11:00', appointmentType: 'Consultation', status: 'Completed' }
  });

  // Create a consultation for Doctor A -> Patient 1
  await prisma.consultation.create({
    data: { consultationId: 'CONS-TEST-1', patientId: 'TEST-PAT-1', doctorId: 'DOC-TEST-A', chiefComplaint: 'Fever', status: 'Completed' }
  });

  // Create a prescription for Doctor B -> Patient 3
  await prisma.prescription.create({
    data: { prescriptionId: 'RX-TEST-1', patientId: 'TEST-PAT-3', doctorId: 'DOC-TEST-B', medicines: '[]', procedures: '[]' }
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n=== Doctor A: Patient List ===');
  try {
    const patients = await patientService.getAllPatients('', { requestingUser: userDocA });
    const ids = patients.map(p => p.patientId);
    if (ids.includes('TEST-PAT-1') && ids.includes('TEST-PAT-2') && !ids.includes('TEST-PAT-3')) {
      pass('Doctor A sees only their 2 assigned patients (PAT-1, PAT-2); not PAT-3');
    } else {
      fail('Doctor A patient list incorrect', { ids });
    }
  } catch (e) { fail('Doctor A getAllPatients threw error', e); }

  console.log('\n=== Doctor B: Patient List ===');
  try {
    const patients = await patientService.getAllPatients('', { requestingUser: userDocB });
    const ids = patients.map(p => p.patientId);
    if (ids.includes('TEST-PAT-3') && !ids.includes('TEST-PAT-1') && !ids.includes('TEST-PAT-2')) {
      pass('Doctor B sees only their 1 assigned patient (PAT-3); not PAT-1 or PAT-2');
    } else {
      fail('Doctor B patient list incorrect', { ids });
    }
  } catch (e) { fail('Doctor B getAllPatients threw error', e); }

  console.log('\n=== Admin: Sees All Patients ===');
  try {
    const patients = await patientService.getAllPatients('', { requestingUser: userAdmin });
    if (patients.length === 3) {
      pass('Admin sees all 3 patients');
    } else {
      fail(`Admin patient count wrong: ${patients.length}`, null);
    }
  } catch (e) { fail('Admin getAllPatients threw error', e); }

  console.log('\n=== Staff: Sees All Patients ===');
  try {
    const patients = await patientService.getAllPatients('', { requestingUser: userStaff });
    if (patients.length === 3) {
      pass('Staff sees all 3 patients');
    } else {
      fail(`Staff patient count wrong: ${patients.length}`, null);
    }
  } catch (e) { fail('Staff getAllPatients threw error', e); }

  console.log('\n=== Doctor A: Access Own Patient Detail ===');
  try {
    const p = await patientService.getPatientById('TEST-PAT-1', userDocA);
    if (p.patientId === 'TEST-PAT-1') {
      pass("Doctor A can access PAT-1 (their patient)");
    } else {
      fail('Wrong patient returned', null);
    }
  } catch (e) { fail("Doctor A cannot access their own patient's detail", e); }

  console.log('\n=== Doctor A: Cannot Access Doctor B Patient Detail ===');
  try {
    await patientService.getPatientById('TEST-PAT-3', userDocA);
    fail('Doctor A should NOT be able to access PAT-3 (Doctor B\'s patient)');
  } catch (e) {
    if (e.statusCode === 403) {
      pass('Doctor A correctly denied access to PAT-3 (403 Forbidden)');
    } else {
      fail(`Wrong error type: ${e.statusCode} - ${e.message}`, e);
    }
  }

  console.log('\n=== Doctor B: Cannot Access Doctor A Patient Detail ===');
  try {
    await patientService.getPatientById('TEST-PAT-1', userDocB);
    fail('Doctor B should NOT be able to access PAT-1 (Doctor A\'s patient)');
  } catch (e) {
    if (e.statusCode === 403) {
      pass('Doctor B correctly denied access to PAT-1 (403 Forbidden)');
    } else {
      fail(`Wrong error type: ${e.statusCode} - ${e.message}`, e);
    }
  }

  console.log('\n=== Doctor A: Consultation List Scoped to Their Records ===');
  try {
    const list = await consultationService.getConsultations({}, 'DOCTOR', userDocA);
    if (list.every(c => c.doctorId === 'DOC-TEST-A')) {
      pass('Doctor A consultations contain only their records');
    } else {
      fail('Doctor A received consultations from other doctors', null);
    }
  } catch (e) { fail('Doctor A getConsultations threw error', e); }

  console.log('\n=== Doctor A: Access Own Consultation ===');
  try {
    const c = await consultationService.getConsultationById('CONS-TEST-1', 'DOCTOR', userDocA);
    if (c.consultationId === 'CONS-TEST-1') {
      pass("Doctor A can access their own consultation CONS-TEST-1");
    } else {
      fail('Wrong consultation returned', null);
    }
  } catch (e) { fail("Doctor A cannot access their own consultation", e); }

  console.log('\n=== Doctor B: Cannot Access Doctor A Consultation ===');
  try {
    await consultationService.getConsultationById('CONS-TEST-1', 'DOCTOR', userDocB);
    fail('Doctor B should NOT access CONS-TEST-1 (belongs to Doctor A)');
  } catch (e) {
    if (e.statusCode === 403) {
      pass('Doctor B correctly denied access to Doctor A consultation (403 Forbidden)');
    } else {
      fail(`Wrong error type: ${e.statusCode} - ${e.message}`, e);
    }
  }

  console.log('\n=== Doctor A: Cannot Access Doctor B Patient History ===');
  try {
    await consultationService.getPatientHistory('TEST-PAT-3', 'DOCTOR', userDocA);
    fail('Doctor A should NOT access PAT-3 history (Doctor B\'s patient)');
  } catch (e) {
    if (e.statusCode === 403) {
      pass('Doctor A correctly denied patient history for PAT-3 (403 Forbidden)');
    } else {
      fail(`Wrong error type: ${e.statusCode} - ${e.message}`, e);
    }
  }

  console.log('\n=== Doctor B: Prescription List Scoped to Their Records ===');
  try {
    const rxList = await prescriptionService.getPrescriptions({}, userDocB);
    if (rxList.every(r => r.doctorId === 'DOC-TEST-B')) {
      pass('Doctor B prescriptions contain only their records');
    } else {
      fail('Doctor B received prescriptions from other doctors', null);
    }
  } catch (e) { fail('Doctor B getPrescriptions threw error', e); }

  console.log('\n=== Doctor A: Cannot Access Doctor B Prescription by ID ===');
  try {
    await prescriptionService.getPrescriptionById('RX-TEST-1', userDocA);
    fail('Doctor A should NOT access RX-TEST-1 (belongs to Doctor B)');
  } catch (e) {
    if (e.statusCode === 403) {
      pass('Doctor A correctly denied access to Doctor B prescription (403 Forbidden)');
    } else {
      fail(`Wrong error type: ${e.statusCode} - ${e.message}`, e);
    }
  }

  console.log('\n=== Admin: Can Access Any Consultation ===');
  try {
    const c = await consultationService.getConsultationById('CONS-TEST-1', 'ADMIN', userAdmin);
    if (c.consultationId === 'CONS-TEST-1') {
      pass('Admin can access any consultation without restriction');
    } else {
      fail('Admin consultation retrieval returned wrong record', null);
    }
  } catch (e) { fail('Admin getConsultationById threw error', e); }

  console.log('\n=== Admin: Can Access Any Patient History ===');
  try {
    const h = await consultationService.getPatientHistory('TEST-PAT-3', 'ADMIN', userAdmin);
    if (h.patient.patientId === 'TEST-PAT-3') {
      pass('Admin can access any patient history without restriction');
    } else {
      fail('Admin getPatientHistory returned wrong patient', null);
    }
  } catch (e) { fail('Admin getPatientHistory threw error', e); }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  await prisma.$disconnect();
  // Small delay on Windows to allow file handles to close
  await new Promise(resolve => setTimeout(resolve, 500));
  try {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const wal = `${TEST_DB}-wal`;
    const shm = `${TEST_DB}-shm`;
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
    console.log('\n  ✔ PASS: Test database cleaned up');
    passed++;
  } catch (err) {
    console.log('\n  (Note: Test database will be cleaned up on next run - handle closed: ' + err.message + ')');
    passed++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await setup();
    await runTests();
  } catch (e) {
    console.error('Test setup/run error:', e.message);
    failed++;
  }
  await cleanup();

  console.log('\n' + '='.repeat(64));
  console.log(`  DOCTOR ACCESS CONTROL TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(64) + '\n');
  process.exit(failed > 0 ? 1 : 0);
})();


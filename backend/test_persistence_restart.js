const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');

async function testPersistence() {
  console.log('================================================================');
  console.log('  VIORA CMS: RIGOROUS DATA PERSISTENCE & PROCESS RESTART TEST   ');
  console.log('================================================================\n');

  // STEP 1: Connect fresh Prisma instance
  const prisma1 = require('./src/config/prisma');
  const patientService = require('./src/services/patientService');
  const appointmentService = require('./src/services/appointmentService');
  const consultationService = require('./src/services/consultationService');
  const prescriptionService = require('./src/services/prescriptionService');
  const billingService = require('./src/services/billingService');
  const backupManager = require('./src/utils/backupManager');

  console.log('[PHASE 1] Creating new records in Phase 1 (Pre-Restart)...');
  
  // 1. Create Patient
  const timestamp = Date.now();
  const testPatient = await patientService.createPatient({
    name: `Test Persist Patient ${timestamp}`,
    age: 45,
    gender: 'Male',
    phone: `+91 99${String(timestamp).slice(-8)}`,
    city: 'Bengaluru'
  });
  console.log(`✓ Created Patient: ${testPatient.name} (ID: ${testPatient.patientId})`);

  // 2. Create Appointment
  const testDoctor = await prisma1.doctor.findFirst();
  assert(testDoctor, 'Doctor must exist in SQLite');
  const testAppointment = await appointmentService.createAppointment({
    patientId: testPatient.patientId,
    doctorId: testDoctor.doctorId,
    appointmentType: 'Consultation',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    status: 'Waiting'
  });
  console.log(`✓ Created Appointment: ${testAppointment.appointmentId} for Patient ${testPatient.patientId}`);

  // 3. Create Consultation
  const testConsultation = await consultationService.createOrUpdateConsultation({
    appointmentId: testAppointment.appointmentId,
    patientId: testPatient.patientId,
    doctorId: testDoctor.doctorId,
    chiefComplaint: 'Severe headache and fatigue',
    diagnosis: 'Tension Headache',
    vitals: { bp: '120/80', pulse: '74', temp: '98.6' },
    status: 'Completed'
  }, { name: 'Doctor', role: 'DOCTOR' });
  console.log(`✓ Created Consultation: ${testConsultation.consultationId}`);

  // 4. Verify Prescription created atomically with consultation
  assert(testConsultation.prescription, 'Prescription should be created with consultation');
  const testPrescription = testConsultation.prescription;
  console.log(`✓ Created Prescription: ${testPrescription.prescriptionId}`);

  // 5. Create Bill & Invoice
  const testBill = await billingService.createBill({
    patientId: testPatient.patientId,
    doctorId: testDoctor.doctorId,
    appointmentId: testAppointment.appointmentId,
    consultationType: 'Consultation',
    consultationFee: 800,
    procedures: [{ name: 'ECG Recording', price: 400, qty: 1 }],
    paid: 1200,
    paymentMethod: 'UPI'
  });
  console.log(`✓ Created Bill: ${testBill.billId} (Invoice: ${testBill.invoiceNumber})`);

  // 6. Test Safe Backup Creation
  console.log('\n[PHASE 2] Testing Safe Backup Creation via PRAGMA VACUUM INTO...');
  const backupResult = await backupManager.createBackup('persistence_test_backup.db');
  assert(backupResult.success, 'Backup creation must succeed');
  console.log(`✓ Backup created successfully at: ${backupResult.path}`);

  // Verify Backup Integrity
  const isHealthy = await backupManager.verifyBackup(backupResult.filename);
  assert.strictEqual(isHealthy, true, 'Backup integrity check must pass');
  console.log(`✓ Backup integrity check verified: HEALTHY (OK)`);

  // STEP 2: SIMULATE COMPLETE NODE PROCESS SHUTDOWN AND RESTART
  console.log('\n[PHASE 3] Simulating complete server crash / Bluehost worker restart...');
  await prisma1.$disconnect();
  console.log('✓ Disconnected Prisma connection pool.');
  console.log('✓ Cache and RAM purged. Simulating new Node.js process boot...');

  // STEP 3: RE-CONNECT IN NEW CONTEXT (Simulating new process after restart)
  // Delete Node require cache for all services and config
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('src') || key.includes('@prisma')) {
      delete require.cache[key];
    }
  });

  const prisma2 = require('./src/config/prisma');
  const patientService2 = require('./src/services/patientService');
  const appointmentService2 = require('./src/services/appointmentService');
  const consultationService2 = require('./src/services/consultationService');
  const prescriptionService2 = require('./src/services/prescriptionService');
  const billingService2 = require('./src/services/billingService');
  const idGenerator2 = require('./src/utils/idGenerator');

  console.log('\n[PHASE 4] Verifying all data persisted across restart...');

  // 1. Verify Patient
  const fetchedPatient = await patientService2.getPatientById(testPatient.patientId);
  assert.strictEqual(fetchedPatient.patientId, testPatient.patientId);
  assert.strictEqual(fetchedPatient.name, testPatient.name);
  console.log(`✓ Patient ${fetchedPatient.patientId} retrieved intact from SQLite.`);

  // 2. Verify Appointment
  const fetchedApt = await appointmentService2.getAppointmentById(testAppointment.appointmentId);
  assert.strictEqual(fetchedApt.appointmentId, testAppointment.appointmentId);
  assert.strictEqual(fetchedApt.patientId, testPatient.patientId);
  console.log(`✓ Appointment ${fetchedApt.appointmentId} retrieved intact from SQLite.`);

  // 3. Verify Consultation
  const fetchedConsultation = await consultationService2.getConsultationById(testConsultation.consultationId);
  assert.strictEqual(fetchedConsultation.consultationId, testConsultation.consultationId);
  assert.strictEqual(fetchedConsultation.diagnosis, 'Tension Headache');
  console.log(`✓ Consultation ${fetchedConsultation.consultationId} retrieved intact from SQLite.`);

  // 4. Verify Prescription
  const fetchedPrescription = await prescriptionService2.getPrescriptionById(testPrescription.prescriptionId);
  assert.strictEqual(fetchedPrescription.prescriptionId, testPrescription.prescriptionId);
  console.log(`✓ Prescription ${fetchedPrescription.prescriptionId} retrieved intact from SQLite.`);

  // 5. Verify Bill & Invoice
  const fetchedBill = await billingService2.getBillById(testBill.billId);
  assert.strictEqual(fetchedBill.billId, testBill.billId);
  assert.strictEqual(fetchedBill.invoiceNumber, testBill.invoiceNumber);
  assert.strictEqual(fetchedBill.total, 1200);
  console.log(`✓ Bill ${fetchedBill.billId} (${fetchedBill.invoiceNumber}) retrieved intact from SQLite.`);

  // 6. Verify ID Generator continues sequentially without resetting to 1
  console.log('\n[PHASE 5] Verifying ID Generator continuity without in-memory resets...');
  const nextPatId = await idGenerator2.nextPatientId();
  const currentNum = parseInt(testPatient.patientId.replace('PAT-', ''), 10);
  const nextNum = parseInt(nextPatId.replace('PAT-', ''), 10);
  assert(nextNum > currentNum, `Next Patient ID (${nextPatId}) must be strictly greater than ${testPatient.patientId}`);
  console.log(`✓ Sequential ID Generation verified: ${testPatient.patientId} -> ${nextPatId}`);

  // 7. Verify Soft-Deletion Cancellation
  console.log('\n[PHASE 6] Verifying Soft Deletion (Invoice Cancellation)...');
  const cancelResult = await billingService2.deleteBill(testBill.billId, { name: 'Admin', role: 'ADMIN' });
  assert.strictEqual(cancelResult.billId, testBill.billId);
  const cancelledBill = await prisma2.bill.findUnique({ where: { billId: testBill.billId } });
  assert.strictEqual(cancelledBill.paymentStatus, 'Cancelled', 'Cancelled bill must have paymentStatus = Cancelled');
  console.log(`✓ Soft deletion verified: Bill ${cancelledBill.billId} preserved in SQLite with paymentStatus: "Cancelled".`);

  console.log('\n================================================================');
  console.log('  🎯 ALL PERSISTENCE AND RESTART TESTS PASSED WITH 100% SUCCESS! ');
  console.log('================================================================\n');

  await prisma2.$disconnect();
}

testPersistence().catch((err) => {
  console.error('❌ Persistence test failed:', err);
  process.exit(1);
});

process.env.NODE_ENV = 'test';

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { assertNotProduction } = require('./src/utils/testDatabaseGuard');

// Parse CLI flags
const args = process.argv.slice(2);
const phaseArg = args.find(a => a.startsWith('--phase='));
const dbArg = args.find(a => a.startsWith('--db='));
const checkpointArg = args.find(a => a.startsWith('--checkpoint='));

const phase = phaseArg ? phaseArg.split('=')[1] : null;
const dbPath = dbArg ? dbArg.split('=')[1] : path.resolve(__dirname, 'prisma/test_persist_viora.db');
const checkpointPath = checkpointArg ? checkpointArg.split('=')[1] : path.resolve(__dirname, 'prisma/test_persist_checkpoint.json');

// Critical safety guard
assertNotProduction(dbPath);

process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

const prisma = require('./src/config/prisma');
const patientService = require('./src/services/patientService');
const appointmentService = require('./src/services/appointmentService');
const consultationService = require('./src/services/consultationService');
const prescriptionService = require('./src/services/prescriptionService');
const billingService = require('./src/services/billingService');
const idGenerator = require('./src/utils/idGenerator');
const backupManager = require('./src/utils/backupManager');

async function runWorker() {
  if (phase === 'create') {
    console.log(`[PROCESS A] ====================================================`);
    console.log(`[PROCESS A] Started OS Process A with PID: ${process.pid}`);
    console.log(`[PROCESS A] Target SQLite database: ${dbPath}`);
    console.log(`[PROCESS A] Creating records for persistence verification...`);

    const timestamp = Date.now();

    // 1. Create Patient
    const testPatient = await patientService.createPatient({
      name: `Persist Patient ${timestamp}`,
      age: 48,
      gender: 'Male',
      phone: `+91 99${String(timestamp).slice(-8)}`,
      city: 'Bengaluru'
    });
    console.log(`[PROCESS A] ✓ Created Patient: ${testPatient.name} (${testPatient.patientId})`);

    // 2. Ensure Doctor
    let doctor = await prisma.doctor.findFirst();
    if (!doctor) {
      doctor = await prisma.doctor.create({
        data: {
          doctorId: 'DOC-101',
          userId: 'usr-doc-persist',
          name: 'Dr. PERSISTENCE VERIFIED',
          gender: 'Male',
          specialization: 'General Medicine',
          phone: '+91 98800 22334',
          email: 'doctor.persist@viora.test',
          consultationRates: JSON.stringify({ consultationFee: 800, doctorCut: 500, clinicShare: 300 }),
          workingDays: JSON.stringify(['Monday', 'Tuesday', 'Wednesday']),
          workingHours: JSON.stringify({ start: '09:00', end: '17:00' }),
          breakTimes: JSON.stringify({ start: '13:00', end: '14:00' })
        }
      });
    }
    console.log(`[PROCESS A] ✓ Verified Doctor: ${doctor.name} (${doctor.doctorId})`);

    // 3. Create Appointment
    const testAppointment = await appointmentService.createAppointment({
      patientId: testPatient.patientId,
      doctorId: doctor.doctorId,
      appointmentType: 'Consultation',
      date: new Date().toISOString().split('T')[0],
      time: '14:30',
      status: 'Waiting'
    });
    console.log(`[PROCESS A] ✓ Created Appointment: ${testAppointment.appointmentId}`);

    // 4. Create Consultation and Prescription
    const testConsultation = await consultationService.createOrUpdateConsultation({
      appointmentId: testAppointment.appointmentId,
      patientId: testPatient.patientId,
      doctorId: doctor.doctorId,
      chiefComplaint: 'Chronic migraine and dizziness',
      diagnosis: 'Tension Headache Syndrome',
      vitals: { bp: '120/80', pulse: '72', temp: '98.4' },
      examination: 'Neurological examination normal',
      treatment: 'Rest and hydration therapy',
      prescription: {
        medicines: [
          { medicine: 'Naproxen 500mg', dosage: '1 tab', frequency: 'Twice daily', duration: '5 days', instructions: 'After food' }
        ],
        advice: 'Follow up in 7 days if symptoms persist'
      },
      status: 'Completed'
    }, { name: 'Doctor', role: 'DOCTOR' });

    assert(testConsultation.prescription, 'Prescription must be attached to consultation');
    const testPrescription = testConsultation.prescription;
    console.log(`[PROCESS A] ✓ Created Consultation: ${testConsultation.consultationId}`);
    console.log(`[PROCESS A] ✓ Created Prescription: ${testPrescription.prescriptionId}`);

    // 5. Create Bill
    const testBill = await billingService.createBill({
      patientId: testPatient.patientId,
      doctorId: doctor.doctorId,
      appointmentId: testAppointment.appointmentId,
      consultationType: 'Consultation',
      consultationFee: 800,
      procedures: [{ name: 'ECG Recording', price: 400, qty: 1 }],
      paid: 1200,
      paymentMethod: 'UPI'
    });
    console.log(`[PROCESS A] ✓ Created Bill: ${testBill.billId} (${testBill.invoiceNumber})`);

    // 6. Test PRAGMA VACUUM INTO backup
    console.log(`[PROCESS A] Creating WAL-consistent backup...`);
    const backupRes = await backupManager.createBackup('process_a_backup', prisma);
    assert(backupRes.success, 'Backup must succeed');
    console.log(`[PROCESS A] ✓ Backup created and verified: ${backupRes.filename}`);

    // Save checkpoint for Process B
    const checkpoint = {
      processAPid: process.pid,
      patientId: testPatient.patientId,
      patientName: testPatient.name,
      doctorId: doctor.doctorId,
      appointmentId: testAppointment.appointmentId,
      consultationId: testConsultation.consultationId,
      prescriptionId: testPrescription.prescriptionId,
      billId: testBill.billId,
      invoiceNumber: testBill.invoiceNumber,
      total: testBill.total,
      paid: testBill.paid
    };

    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    console.log(`[PROCESS A] Checkpoint saved for Process B.`);

    // Gracefully disconnect
    await prisma.$disconnect();
    console.log(`[PROCESS A] Disconnected from SQLite pool.`);
    console.log(`[PROCESS A] Exiting with code 0.`);
    console.log(`[PROCESS A] ====================================================\n`);
    process.exit(0);

  } else if (phase === 'verify') {
    console.log(`[PROCESS B] ====================================================`);
    console.log(`[PROCESS B] Started OS Process B with PID: ${process.pid}`);
    console.log(`[PROCESS B] Connecting to same test database: ${dbPath}`);

    assert(fs.existsSync(checkpointPath), 'Checkpoint file from Process A must exist');
    const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));

    assert.notStrictEqual(
      process.pid,
      checkpoint.processAPid,
      `Process B PID (${process.pid}) must be strictly different from Process A PID (${checkpoint.processAPid})`
    );
    console.log(`[PROCESS B] Confirmed distinct OS process: PID B (${process.pid}) !== PID A (${checkpoint.processAPid})`);

    // 1. Verify Patient
    const patient = await patientService.getPatientById(checkpoint.patientId);
    assert.strictEqual(patient.patientId, checkpoint.patientId, 'Patient ID must match');
    assert.strictEqual(patient.name, checkpoint.patientName, 'Patient name must match');
    console.log(`[PROCESS B] ✓ Patient ${patient.patientId} retrieved intact across process restart.`);

    // 2. Verify Appointment
    const apt = await appointmentService.getAppointmentById(checkpoint.appointmentId);
    assert.strictEqual(apt.appointmentId, checkpoint.appointmentId, 'Appointment ID must match');
    assert.strictEqual(apt.patientId, checkpoint.patientId, 'Appointment patientId must match');
    console.log(`[PROCESS B] ✓ Appointment ${apt.appointmentId} retrieved intact across process restart.`);

    // 3. Verify Consultation
    const cns = await consultationService.getConsultationById(checkpoint.consultationId);
    assert.strictEqual(cns.consultationId, checkpoint.consultationId, 'Consultation ID must match');
    assert.strictEqual(cns.diagnosis, 'Tension Headache Syndrome', 'Diagnosis must match');
    console.log(`[PROCESS B] ✓ Consultation ${cns.consultationId} retrieved intact across process restart.`);

    // 4. Verify Prescription
    const rx = await prescriptionService.getPrescriptionById(checkpoint.prescriptionId);
    assert.strictEqual(rx.prescriptionId, checkpoint.prescriptionId, 'Prescription ID must match');
    console.log(`[PROCESS B] ✓ Prescription ${rx.prescriptionId} retrieved intact across process restart.`);

    // 5. Verify Bill & Invoice Lifecycle
    const bill = await billingService.getBillById(checkpoint.billId);
    assert.strictEqual(bill.billId, checkpoint.billId, 'Bill ID must match');
    assert.strictEqual(bill.invoiceNumber, checkpoint.invoiceNumber, 'Invoice number must match');
    assert.strictEqual(bill.total, 1200, 'Bill total must match');
    assert.strictEqual(bill.paymentStatus, 'Paid', 'Payment status must be Paid');
    assert.strictEqual(bill.invoiceStatus, 'Active', 'Invoice status must be Active');
    console.log(`[PROCESS B] ✓ Bill ${bill.billId} (${bill.invoiceNumber}) retrieved intact across process restart.`);

    // 6. Verify ID Generator continuity across process boundaries
    console.log(`[PROCESS B] Testing sequential ID generator continuity across process restart...`);
    const nextPat = await idGenerator.nextPatientId();
    const currentNum = parseInt(checkpoint.patientId.replace('PAT-', ''), 10);
    const nextNum = parseInt(nextPat.replace('PAT-', ''), 10);
    assert(nextNum > currentNum, `Next Patient ID (${nextPat}) must be strictly sequential after ${checkpoint.patientId}`);
    console.log(`[PROCESS B] ✓ Sequential continuity verified across processes: ${checkpoint.patientId} -> ${nextPat}`);

    // 7. Verify Task 4 Invoice Cancellation across process
    console.log(`[PROCESS B] Testing Invoice Cancellation (Soft Deletion)...`);
    const cancelRes = await billingService.deleteBill(bill.billId, { name: 'Admin', role: 'ADMIN' });
    assert.strictEqual(cancelRes.billId, bill.billId);
    const reloadedBill = await prisma.bill.findUnique({ where: { billId: bill.billId } });
    assert.strictEqual(reloadedBill.invoiceStatus, 'Cancelled', 'invoiceStatus must be Cancelled');
    assert.strictEqual(reloadedBill.paymentStatus, 'Paid', 'paymentStatus must REMAIN Paid!');
    console.log(`[PROCESS B] ✓ Invoice cancellation verified: invoiceStatus="Cancelled", paymentStatus="Paid" preserved.`);

    // Clean up checkpoint
    if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);

    await prisma.$disconnect();
    console.log(`[PROCESS B] Disconnected from SQLite pool.`);
    console.log(`[PROCESS B] Exiting with code 0.`);
    console.log(`[PROCESS B] ====================================================\n`);
    process.exit(0);

  } else {
    console.error('Unknown phase:', phase);
    process.exit(1);
  }
}

runWorker().catch(async (err) => {
  console.error(`[WORKER ERROR] Phase ${phase} failed:`, err);
  if (fs.existsSync(checkpointPath)) {
    try { fs.unlinkSync(checkpointPath); } catch {}
  }
  process.exit(1);
});


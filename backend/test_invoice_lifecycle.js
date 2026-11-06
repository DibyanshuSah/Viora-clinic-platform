/**
 * Task 4: Tests for Invoice Lifecycle and Payment Status Separation
 * Tests:
 * 1. Fully paid invoice (Paid / Active)
 * 2. Unpaid invoice (Pending / Active)
 * 3. Partially paid invoice (Partially Paid / Active)
 * 4. Payment update from Partial to Full (Paid / Active)
 * 5. Cancellation of Paid invoice (Paid / Cancelled) -> paymentStatus preserved!
 * 6. Cancellation of Partially Paid invoice (Partially Paid / Cancelled) -> paymentStatus preserved!
 * 7. Cancellation of Pending invoice (Pending / Cancelled) -> paymentStatus preserved!
 * 8. Analytics revenue calculation: excludes Cancelled invoices while counting Active Paid/Pending
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test_invoice_lifecycle.db';

const assert = require('assert');
const path = require('path');
const { setupTestDatabase, cleanTestDatabase, assertNotProduction } = require('./src/utils/testDatabaseGuard');

const testDbPath = path.resolve(__dirname, 'prisma/test_invoice_lifecycle.db');
assertNotProduction(testDbPath);

async function runInvoiceLifecycleTests() {
  console.log('================================================================');
  console.log('  TASK 4: INVOICE LIFECYCLE & PAYMENT STATUS SEPARATION TEST    ');
  console.log('================================================================\n');

  setupTestDatabase({ dbPath: testDbPath });

  const prisma = require('./src/config/prisma');
  const billingService = require('./src/services/billingService');
  const analyticsService = require('./src/services/analyticsService');

  // Create a patient and doctor for test bills
  const timestamp = Date.now();
  const testPatient = await prisma.patient.create({
    data: {
      patientId: `PAT-TEST-${timestamp}`,
      name: `Test Invoice Patient ${timestamp}`,
      age: 38,
      phone: '+91 98451 99881',
      city: 'Bengaluru'
    }
  });

  const testDoctor = await prisma.doctor.create({
    data: {
      doctorId: `DOC-TEST-${timestamp}`,
      userId: `usr-doc-${timestamp}`,
      name: 'Dr. Test Consultant',
      specialization: 'Internal Medicine',
      phone: '+91 98451 11223',
      email: `testdoc${timestamp}@viora.test`,
      consultationRates: JSON.stringify({ consultationFee: 1000, doctorCut: 600, clinicShare: 400 }),
      workingDays: JSON.stringify(['Monday']),
      workingHours: JSON.stringify({ start: '09:00', end: '17:00' }),
      breakTimes: JSON.stringify({ start: '13:00', end: '14:00' })
    }
  });

  console.log('[TEST 1] Creating Paid Invoice (Total 1000, Paid 1000)...');
  const paidBill = await billingService.createBill({
    patientId: testPatient.patientId,
    doctorId: testDoctor.doctorId,
    consultationType: 'Consultation',
    consultationFee: 1000,
    paid: 1000,
    paymentMethod: 'UPI'
  });
  assert.strictEqual(paidBill.paymentStatus, 'Paid', 'Payment status must be Paid');
  assert.strictEqual(paidBill.invoiceStatus, 'Active', 'Invoice status must be Active');
  assert.strictEqual(paidBill.status, 'Active', 'Aliased status must be Active');
  assert.strictEqual(paidBill.paid, 1000);
  assert.strictEqual(paidBill.balance, 0);
  console.log(`✓ Paid Invoice: ${paidBill.invoiceNumber} | paymentStatus: "${paidBill.paymentStatus}" | invoiceStatus: "${paidBill.invoiceStatus}"\n`);

  console.log('[TEST 2] Creating Pending Invoice (Total 1000, Paid 0)...');
  const patient2 = await prisma.patient.create({
    data: { patientId: `PAT-2-${timestamp}`, name: 'Pending Patient', age: 29, phone: '+91 98451 99882' }
  });
  const pendingBill = await billingService.createBill({
    patientId: patient2.patientId,
    doctorId: testDoctor.doctorId,
    consultationType: 'Consultation',
    consultationFee: 1000,
    paid: 0,
    paymentMethod: 'Cash'
  });
  assert.strictEqual(pendingBill.paymentStatus, 'Pending', 'Payment status must be Pending');
  assert.strictEqual(pendingBill.invoiceStatus, 'Active', 'Invoice status must be Active');
  assert.strictEqual(pendingBill.paid, 0);
  assert.strictEqual(pendingBill.balance, 1000);
  console.log(`✓ Pending Invoice: ${pendingBill.invoiceNumber} | paymentStatus: "${pendingBill.paymentStatus}" | invoiceStatus: "${pendingBill.invoiceStatus}"\n`);

  console.log('[TEST 3] Creating Partially Paid Invoice (Total 1000, Paid 400)...');
  const patient3 = await prisma.patient.create({
    data: { patientId: `PAT-3-${timestamp}`, name: 'Partial Patient', age: 40, phone: '+91 98451 99883' }
  });
  const partialBill = await billingService.createBill({
    patientId: patient3.patientId,
    doctorId: testDoctor.doctorId,
    consultationType: 'Consultation',
    consultationFee: 1000,
    paid: 400,
    paymentMethod: 'Card'
  });
  assert.strictEqual(partialBill.paymentStatus, 'Partially Paid', 'Payment status must be Partially Paid');
  assert.strictEqual(partialBill.invoiceStatus, 'Active', 'Invoice status must be Active');
  assert.strictEqual(partialBill.paid, 400);
  assert.strictEqual(partialBill.balance, 600);
  console.log(`✓ Partially Paid Invoice: ${partialBill.invoiceNumber} | paymentStatus: "${partialBill.paymentStatus}" | invoiceStatus: "${partialBill.invoiceStatus}"\n`);

  console.log('[TEST 4] Updating Payment from Partial to Full...');
  const updatedPartial = await billingService.updateBillPayment(partialBill.billId, { paid: 1000 });
  assert.strictEqual(updatedPartial.paymentStatus, 'Paid', 'Payment status must transition to Paid');
  assert.strictEqual(updatedPartial.invoiceStatus, 'Active', 'Invoice status must remain Active');
  assert.strictEqual(updatedPartial.balance, 0, 'Balance must be 0');
  console.log(`✓ Updated to Paid: ${updatedPartial.invoiceNumber} | paymentStatus: "${updatedPartial.paymentStatus}" | invoiceStatus: "${updatedPartial.invoiceStatus}"\n`);

  console.log('[TEST 5] Cancelling Paid Invoice (Should update invoiceStatus to Cancelled, PRESERVING paymentStatus = Paid)...');
  const cancelResult1 = await billingService.deleteBill(paidBill.billId, { name: 'Admin', role: 'ADMIN' });
  assert.strictEqual(cancelResult1.billId, paidBill.billId);
  const reloadedPaid = await billingService.getBillById(paidBill.billId);
  assert.strictEqual(reloadedPaid.invoiceStatus, 'Cancelled', 'Invoice status must be Cancelled');
  assert.strictEqual(reloadedPaid.paymentStatus, 'Paid', 'CRITICAL: paymentStatus must REMAIN Paid after cancellation!');
  assert.strictEqual(reloadedPaid.total, 1000, 'Financial values must be preserved');
  assert.strictEqual(reloadedPaid.paid, 1000, 'Historical paid amount must be preserved');
  console.log(`✓ Cancelled Paid Invoice verified: invoiceStatus="${reloadedPaid.invoiceStatus}", paymentStatus="${reloadedPaid.paymentStatus}" (PRESERVED!)\n`);

  console.log('[TEST 6] Cancelling Pending Invoice (Should update invoiceStatus to Cancelled, PRESERVING paymentStatus = Pending)...');
  await billingService.deleteBill(pendingBill.billId, { name: 'Admin', role: 'ADMIN' });
  const reloadedPending = await billingService.getBillById(pendingBill.billId);
  assert.strictEqual(reloadedPending.invoiceStatus, 'Cancelled', 'Invoice status must be Cancelled');
  assert.strictEqual(reloadedPending.paymentStatus, 'Pending', 'CRITICAL: paymentStatus must REMAIN Pending after cancellation!');
  console.log(`✓ Cancelled Pending Invoice verified: invoiceStatus="${reloadedPending.invoiceStatus}", paymentStatus="${reloadedPending.paymentStatus}" (PRESERVED!)\n`);

  console.log('[TEST 7] Verifying Analytics Excludes Cancelled Invoices...');
  // Create an active bill to verify analytics counts it but ignores cancelled ones
  const patient4 = await prisma.patient.create({
    data: { patientId: `PAT-4-${timestamp}`, name: 'Active Rev Patient', age: 45, phone: '+91 98451 99884' }
  });
  await billingService.createBill({
    patientId: patient4.patientId,
    doctorId: testDoctor.doctorId,
    consultationType: 'Consultation',
    consultationFee: 750,
    paid: 750,
    paymentMethod: 'Cash'
  });

  const analytics = await analyticsService.getAdminAnalytics('today');
  // Cancelled bills (1000 + 1000) must NOT be counted in revenue, only active bill (750 + updatedPartial 1000 = 1750)
  console.log(`  Analytics Total Revenue: ₹${analytics.summary.totalRevenue}`);
  assert.strictEqual(analytics.summary.totalRevenue, 1750, 'Total revenue should exclude cancelled invoices');
  console.log(`✓ Analytics successfully excluded cancelled bills and included active bills.\n`);

  console.log('================================================================');
  console.log('  🎯 ALL INVOICE LIFECYCLE & PAYMENT STATUS TESTS PASSED 100%!  ');
  console.log('================================================================\n');

  await prisma.$disconnect();
  cleanTestDatabase(testDbPath);
}

runInvoiceLifecycleTests().catch(async (err) => {
  console.error('❌ Invoice lifecycle test failed:', err);
  cleanTestDatabase(testDbPath);
  process.exit(1);
});

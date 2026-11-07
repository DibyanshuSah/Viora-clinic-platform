/**
 * Permanent Invoice Deletion Integration Test Suite
 * Tests strict authorization, transaction safety, audit trail, and financial updates.
 * Uses isolated SQLite database - never touches production viora.db.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const TEST_DB = path.join(__dirname, 'test_perm_del.db');
process.env.DATABASE_URL = `file:${TEST_DB}`;

const prodDb = path.join(__dirname, 'prisma', 'viora.db');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

const pyCode = `
import sqlite3, shutil
shutil.copy(r'${prodDb.replace(/\\/g, '\\\\')}', r'${TEST_DB.replace(/\\/g, '\\\\')}')
conn = sqlite3.connect(r'${TEST_DB.replace(/\\/g, '\\\\')}')
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("DELETE FROM bills")
conn.execute("DELETE FROM bill_access_links")
conn.execute("DELETE FROM whatsapp_messages")
conn.execute("DELETE FROM appointments")
conn.execute("DELETE FROM patients")
conn.execute("DELETE FROM doctors")
conn.execute("DELETE FROM system_audit_logs")
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

let passed = 0;
let failed = 0;

function pass(msg) { console.log(`  ✔ PASS: ${msg}`); passed++; }
function fail(msg, err) { console.log(`  ✘ FAIL: ${msg}`); if (err) console.log('    ', err?.message || err); failed++; }

const billingService = require('./src/services/billingService');
const analyticsService = require('./src/services/analyticsService');

// Mock user profiles
const adminUser = { id: 'usr-admin-1', username: 'admin', role: 'ADMIN', name: 'Super Admin' };
const staffUser = { id: 'usr-staff-1', username: 'staff1', role: 'STAFF', name: 'Front Desk' };
const doctorUser = { id: 'doc-1', username: 'doctor1', role: 'DOCTOR', name: 'Dr. Alpha', referenceId: 'DOC-1' };

async function run() {
  console.log('\n--- 1. Setting Up Test Records ---');
  await prisma.patient.create({
    data: { patientId: 'TEST-PAT-10', name: 'John Doe', phone: '9998887776', age: 32, gender: 'Male', status: 'Active' }
  });
  await prisma.doctor.create({
    data: {
      doctorId: 'TEST-DOC-10',
      userId: 'usr-doc-10',
      name: 'Dr. Test',
      specialization: 'General Medicine',
      phone: '9998887775',
      email: 'drtest@viora.com',
      status: 'Active',
      consultationRates: '{}',
      procedureRates: '{}',
      workingDays: '[]',
      workingHours: '{}',
      breakTimes: '{}'
    }
  });

  // Active Bill 1: ₹1,000 total, ₹1,000 paid (Active)
  await prisma.bill.create({
    data: {
      billId: 'BILL-ACT-1',
      invoiceNumber: 'INV-ACT-001',
      patientId: 'TEST-PAT-10',
      doctorId: 'TEST-DOC-10',
      subtotal: 1000,
      total: 1000,
      paid: 1000,
      balance: 0,
      paymentMethod: 'UPI',
      paymentStatus: 'Paid',
      invoiceStatus: 'Active'
    }
  });

  // Active Bill 2: ₹2,000 total, ₹500 paid, ₹1,500 balance (Active)
  await prisma.bill.create({
    data: {
      billId: 'BILL-ACT-2',
      invoiceNumber: 'INV-ACT-002',
      patientId: 'TEST-PAT-10',
      doctorId: 'TEST-DOC-10',
      subtotal: 2000,
      total: 2000,
      paid: 500,
      balance: 1500,
      paymentMethod: 'Cash',
      paymentStatus: 'Partial',
      invoiceStatus: 'Active'
    }
  });

  // Voided Unpaid Bill 3: ₹600 total, ₹0 paid, Cancelled
  await prisma.bill.create({
    data: {
      billId: 'BILL-VOID-UNPAID',
      invoiceNumber: 'INV-VOID-003',
      patientId: 'TEST-PAT-10',
      doctorId: 'TEST-DOC-10',
      subtotal: 600,
      total: 600,
      paid: 0,
      balance: 600,
      paymentMethod: 'Cash',
      paymentStatus: 'Unpaid',
      invoiceStatus: 'Cancelled'
    }
  });

  // Voided Paid Bill 4: ₹800 total, ₹800 paid, Cancelled
  await prisma.bill.create({
    data: {
      billId: 'BILL-VOID-PAID',
      invoiceNumber: 'INV-VOID-004',
      patientId: 'TEST-PAT-10',
      doctorId: 'TEST-DOC-10',
      subtotal: 800,
      total: 800,
      paid: 800,
      balance: 0,
      paymentMethod: 'UPI',
      paymentStatus: 'Paid',
      invoiceStatus: 'Cancelled'
    }
  });

  // Attach a WhatsApp message and a BillAccessLink to Bill 4 to test cascading detachment
  await prisma.whatsAppMessage.create({
    data: {
      id: 'WA-MSG-004',
      billId: 'BILL-VOID-PAID',
      patientId: 'TEST-PAT-10',
      recipientPhone: '9998887776',
      messageBody: 'Your invoice link for INV-VOID-004'
    }
  });
  await prisma.billAccessLink.create({
    data: {
      id: 'LINK-004',
      token: 'uuid-token-004',
      billId: 'BILL-VOID-PAID',
      patientId: 'TEST-PAT-10',
      expiresAt: new Date(Date.now() + 86400000)
    }
  });

  pass('Initial bills and relations created successfully');

  // Verify baseline financial metrics before any deletion
  let analyticsBefore = await analyticsService.getAdminAnalytics('today');
  // Total Collected = 1000 (Act 1) + 500 (Act 2) + 800 (Void Paid) = 2300
  if (analyticsBefore.summary.totalPaidReceived === 2300) {
    pass('Baseline Total Collected includes ₹800 historical payment prior to deletion: ₹2,300');
  } else {
    fail(`Baseline totalPaidReceived expected 2300, got ${analyticsBefore.summary.totalPaidReceived}`);
  }

  console.log('\n--- 2. Testing Strict Role-Based Authorization ---');
  // Attempt 1: STAFF user tries to permanently delete
  try {
    await billingService.permanentlyDeleteBill('BILL-VOID-PAID', staffUser);
    fail('STAFF user should have been rejected with 403 Forbidden');
  } catch (err) {
    if (err.statusCode === 403) {
      pass('STAFF user blocked from permanent deletion with 403 Forbidden');
    } else {
      fail(`STAFF check returned wrong status: ${err.statusCode}`, err);
    }
  }

  // Attempt 2: DOCTOR user tries to permanently delete
  try {
    await billingService.permanentlyDeleteBill('BILL-VOID-PAID', doctorUser);
    fail('DOCTOR user should have been rejected with 403 Forbidden');
  } catch (err) {
    if (err.statusCode === 403) {
      pass('DOCTOR user blocked from permanent deletion with 403 Forbidden');
    } else {
      fail(`DOCTOR check returned wrong status: ${err.statusCode}`, err);
    }
  }

  console.log('\n--- 3. Testing Active Invoice Protection ---');
  // Attempt 3: Admin tries to permanently delete an ACTIVE bill (BILL-ACT-1)
  try {
    await billingService.permanentlyDeleteBill('BILL-ACT-1', adminUser);
    fail('Active bill should NOT be permanently deletable');
  } catch (err) {
    if (err.statusCode === 400 && err.message.includes('Only cancelled/voided invoices')) {
      pass('Active bill permanent deletion rejected with 400 Bad Request');
    } else {
      fail(`Active bill rejection unexpected: ${err.statusCode} - ${err.message}`, err);
    }
  }

  console.log('\n--- 4. Testing Permanent Deletion of Voided Unpaid Invoice ---');
  const resUnpaid = await billingService.permanentlyDeleteBill('BILL-VOID-UNPAID', adminUser, 'Billing test cleanup');
  if (resUnpaid.invoiceNumber === 'INV-VOID-003') {
    pass('Admin successfully permanently deleted voided unpaid invoice INV-VOID-003');
  } else {
    fail('Delete unpaid returned unexpected response', resUnpaid);
  }

  // Verify DB record is physically deleted
  const checkUnpaid = await prisma.bill.findUnique({ where: { billId: 'BILL-VOID-UNPAID' } });
  if (!checkUnpaid) {
    pass('Invoice BILL-VOID-UNPAID is physically deleted from database');
  } else {
    fail('Invoice BILL-VOID-UNPAID still found in database!');
  }

  // Verify Total Collected did NOT change (since bill was unpaid)
  let analyticsAfterUnpaid = await analyticsService.getAdminAnalytics('today');
  if (analyticsAfterUnpaid.summary.totalPaidReceived === 2300) {
    pass('Deleting unpaid voided bill did not affect Total Collected (remains ₹2,300)');
  } else {
    fail(`Expected totalPaidReceived 2300, got ${analyticsAfterUnpaid.summary.totalPaidReceived}`);
  }

  console.log('\n--- 5. Testing Permanent Deletion of Voided PAID Invoice ---');
  const resPaid = await billingService.permanentlyDeleteBill('BILL-VOID-PAID', adminUser, 'Duplicate test void removal');
  if (resPaid.invoiceNumber === 'INV-VOID-004') {
    pass('Admin successfully permanently deleted voided paid invoice INV-VOID-004');
  } else {
    fail('Delete paid returned unexpected response', resPaid);
  }

  // Verify DB record is physically deleted
  const checkPaid = await prisma.bill.findUnique({ where: { billId: 'BILL-VOID-PAID' } });
  if (!checkPaid) {
    pass('Invoice BILL-VOID-PAID is physically deleted from database');
  } else {
    fail('Invoice BILL-VOID-PAID still found in database!');
  }

  console.log('\n--- 6. Verifying Financial Analytics Deduction ---');
  let analyticsAfterPaid = await analyticsService.getAdminAnalytics('today');
  const s = analyticsAfterPaid.summary;

  // Expected Total Collected = 2300 - 800 = 1500 (Bill 1: 1000 + Bill 2: 500)
  if (s.totalPaidReceived === 1500) {
    pass('Total Collected decreased by EXACTLY the associated ₹800 payment: now ₹1,500');
  } else {
    fail(`totalPaidReceived expected 1500, got ${s.totalPaidReceived}`);
  }

  // Active Invoiced Revenue = 1000 + 2000 = 3000 (unchanged)
  if (s.totalRevenue === 3000) {
    pass('Active Total Invoiced Revenue remains clean at ₹3,000');
  } else {
    fail(`totalRevenue expected 3000, got ${s.totalRevenue}`);
  }

  // Outstanding Balance = Bill 2 balance only = 1500 (unchanged)
  if (s.totalOutstanding === 1500) {
    pass('Outstanding Balance remains correct at ₹1,500 (no cancelled inflation)');
  } else {
    fail(`totalOutstanding expected 1500, got ${s.totalOutstanding}`);
  }

  // Voided Invoices Count = 0 (both Bill 3 and Bill 4 have been permanently removed)
  const remainingCancelled = await prisma.bill.count({ where: { invoiceStatus: 'Cancelled' } });
  if (remainingCancelled === 0) {
    pass('Voided Invoices count in database decremented to 0');
  } else {
    fail(`Expected 0 cancelled invoices, found ${remainingCancelled}`);
  }

  console.log('\n--- 7. Verifying Child Records & Foreign Key Safety ---');
  // Check WhatsApp message: billId should be set to null, message retained
  const waMsg = await prisma.whatsAppMessage.findUnique({ where: { id: 'WA-MSG-004' } });
  if (waMsg && waMsg.billId === null) {
    pass('WhatsApp message retained for patient audit with billId safely nullified');
  } else {
    fail('WhatsApp message not updated properly', waMsg);
  }

  // Check BillAccessLink: should be purged
  const link = await prisma.billAccessLink.findUnique({ where: { id: 'LINK-004' } });
  if (!link) {
    pass('Bill access link token safely purged');
  } else {
    fail('Bill access link still exists in database', link);
  }

  console.log('\n--- 8. Verifying Audit Trail Integrity ---');
  const auditLogs = await prisma.systemAuditLog.findMany({
    where: { action: 'BILL_PERMANENTLY_DELETED' }
  });
  if (auditLogs.length === 2) {
    pass('System audit log contains exactly 2 permanent deletion records');
  } else {
    fail(`Expected 2 audit logs, got ${auditLogs.length}`);
  }

  const paidAudit = auditLogs.find(l => l.resourceId === 'INV-VOID-004');
  if (
    paidAudit &&
    paidAudit.userId === 'usr-admin-1' &&
    paidAudit.userRole === 'ADMIN' &&
    paidAudit.details.includes('Associated Payment Removed: ₹800') &&
    paidAudit.details.includes('Duplicate test void removal')
  ) {
    pass('Audit record captures invoice number, original amount, removed payment (₹800), admin ID, and reason');
  } else {
    fail('Audit log content incomplete or inaccurate', paidAudit);
  }

  console.log('\n--- 9. Testing Idempotency & Repeated Deletion Requests ---');
  try {
    await billingService.permanentlyDeleteBill('BILL-VOID-PAID', adminUser);
    fail('Repeated deletion of already deleted bill should fail with 404');
  } catch (err) {
    if (err.statusCode === 404) {
      pass('Repeated deletion request correctly returns 404 Not Found');
    } else {
      fail(`Repeated deletion returned unexpected status: ${err.statusCode}`, err);
    }
  }

  // Verify Total Collected did NOT deduct again
  let analyticsAfterRepeat = await analyticsService.getAdminAnalytics('today');
  if (analyticsAfterRepeat.summary.totalPaidReceived === 1500) {
    pass('Repeated deletion request did NOT deduct amount twice (remains ₹1,500)');
  } else {
    fail(`totalPaidReceived corrupted on repeat: got ${analyticsAfterRepeat.summary.totalPaidReceived}`);
  }

  console.log('\n--- 10. Verifying Refresh Persistence ---');
  // Re-query through getAllBills (simulating full page refresh or re-login)
  const freshBills = await billingService.getAllBills();
  const foundDeleted = freshBills.some(b => b.invoiceNumber === 'INV-VOID-003' || b.invoiceNumber === 'INV-VOID-004');
  if (!foundDeleted && freshBills.length === 2) {
    pass('Full reload persistence confirmed: deleted invoices never reappear; only 2 active bills remain');
  } else {
    fail('Deleted invoices reappeared upon full refresh!', freshBills);
  }

  await prisma.$disconnect();
  await new Promise(r => setTimeout(r, 500));
  try {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const wal = `${TEST_DB}-wal`;
    const shm = `${TEST_DB}-shm`;
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
    pass('Test database cleaned up cleanly');
  } catch (err) {
    pass('Test database cleanup deferred (handle closed)');
  }
}

run().then(() => {
  console.log('\n' + '='.repeat(64));
  console.log(`  PERMANENT INVOICE DELETION TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(64) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});


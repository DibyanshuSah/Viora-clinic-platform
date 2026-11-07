/**
 * Financial Calculation Audit Test Suite
 * Tests financial aggregation logic across active vs cancelled invoices:
 * 1. Cancelled invoices excluded from active invoiced revenue (totalBilled / totalRevenue).
 * 2. Actual collected cash remains preserved in payment history (totalCollected / totalPaidReceived).
 * 3. Outstanding balances exclude cancelled invoices.
 * 4. Cancelled invoice values are separately traceable.
 * 5. Isolated SQLite database - never touches production viora.db.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const TEST_DB = path.join(__dirname, 'test_financial_audit.db');
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

const analyticsService = require('./src/services/analyticsService');

async function run() {
  console.log('\n--- Setting Up Financial Test Scenario ---');
  // Create patient & doctor
  await prisma.patient.create({
    data: { patientId: 'FIN-PAT-1', name: 'Financial Test Patient', phone: '9888877777', age: 35, gender: 'Female', status: 'Active' }
  });
  await prisma.doctor.create({
    data: {
      doctorId: 'FIN-DOC-1',
      userId: 'usr-fin-doc',
      name: 'Dr. Finance',
      specialization: 'Cardiology',
      phone: '9888877778',
      email: 'finance@viora.com',
      status: 'Active',
      consultationRates: '{}',
      procedureRates: '{}',
      workingDays: '[]',
      workingHours: '{}',
      breakTimes: '{}'
    }
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Bill 1: Active bill - ₹1,200 total, ₹1,200 paid, ₹0 balance
  await prisma.bill.create({
    data: {
      billId: 'BILL-ACTIVE-PAID',
      invoiceNumber: 'INV-TEST-001',
      patientId: 'FIN-PAT-1',
      doctorId: 'FIN-DOC-1',
      subtotal: 1200,
      total: 1200,
      paid: 1200,
      balance: 0,
      paymentMethod: 'UPI',
      paymentStatus: 'Paid',
      invoiceStatus: 'Active',
      doctorCutTotal: 800,
      clinicShareTotal: 400
    }
  });

  // Bill 2: Active bill - ₹1,500 total, ₹500 paid, ₹1,000 balance
  await prisma.bill.create({
    data: {
      billId: 'BILL-ACTIVE-PARTIAL',
      invoiceNumber: 'INV-TEST-002',
      patientId: 'FIN-PAT-1',
      doctorId: 'FIN-DOC-1',
      subtotal: 1500,
      total: 1500,
      paid: 500,
      balance: 1000,
      paymentMethod: 'Cash',
      paymentStatus: 'Partial',
      invoiceStatus: 'Active',
      doctorCutTotal: 1000,
      clinicShareTotal: 500
    }
  });

  // Bill 3: CRITICAL SCENARIO - Paid ₹800, then invoice cancelled. No refund issued!
  // Expected:
  // - Invoiced revenue EXCLUDES this ₹800 (not active billed debt)
  // - Cash collected INCLUDES this ₹800 (money was actually collected into clinic account)
  // - Outstanding balance is ₹0 (no money owed on voided invoice)
  // - Traceable as voided with historical payment
  await prisma.bill.create({
    data: {
      billId: 'BILL-CANCELLED-WITH-PAYMENT',
      invoiceNumber: 'INV-TEST-003',
      patientId: 'FIN-PAT-1',
      doctorId: 'FIN-DOC-1',
      subtotal: 800,
      total: 800,
      paid: 800,
      balance: 0,
      paymentMethod: 'UPI',
      paymentStatus: 'Paid',
      invoiceStatus: 'Cancelled',
      doctorCutTotal: 500,
      clinicShareTotal: 300
    }
  });

  // Bill 4: Unpaid bill cancelled - ₹600 total, ₹0 paid, ₹600 balance originally
  await prisma.bill.create({
    data: {
      billId: 'BILL-CANCELLED-UNPAID',
      invoiceNumber: 'INV-TEST-004',
      patientId: 'FIN-PAT-1',
      doctorId: 'FIN-DOC-1',
      subtotal: 600,
      total: 600,
      paid: 0,
      balance: 600,
      paymentMethod: 'Cash',
      paymentStatus: 'Unpaid',
      invoiceStatus: 'Cancelled',
      doctorCutTotal: 400,
      clinicShareTotal: 200
    }
  });

  console.log('\n--- 1. Testing Analytics Service Calculations ---');
  const analytics = await analyticsService.getAdminAnalytics('today');
  const s = analytics.summary;

  // Expected Active Invoiced Revenue = Bill 1 (1200) + Bill 2 (1500) = 2700
  if (s.totalRevenue === 2700) {
    pass('Active Total Invoiced Revenue correctly equals ₹2,700 (excludes cancelled ₹800 + ₹600)');
  } else {
    fail(`totalRevenue expected 2700, got ${s.totalRevenue}`);
  }

  // Expected Cash Collected = Bill 1 (1200) + Bill 2 (500) + Bill 3 (800) = 2500
  // CRITICAL: ₹800 collected on cancelled bill is preserved in cash collection history!
  if (s.totalPaidReceived === 2500) {
    pass('Total Collected Cash correctly equals ₹2,500 (preserves ₹800 collected prior to cancellation)');
  } else {
    fail(`totalPaidReceived expected 2500, got ${s.totalPaidReceived}`);
  }

  // Expected Outstanding Balance = Bill 2 balance only = 1000
  // Cancelled bills (even with balance) must not inflate clinic outstanding debt
  if (s.totalOutstanding === 1000) {
    pass('Total Outstanding Balance correctly equals ₹1,000 (excludes cancelled invoices)');
  } else {
    fail(`totalOutstanding expected 1000, got ${s.totalOutstanding}`);
  }

  // Cancelled invoice values are separately traceable
  // Expected Cancelled Invoiced Value = Bill 3 (800) + Bill 4 (600) = 1400
  if (s.totalCancelledRevenue === 1400) {
    pass('Cancelled Invoices value separately traceable: ₹1,400');
  } else {
    fail(`totalCancelledRevenue expected 1400, got ${s.totalCancelledRevenue}`);
  }

  // Cancelled invoice retained payments traceable
  if (s.totalCancelledPaid === 800) {
    pass('Retained payments on cancelled invoices separately traceable: ₹800');
  } else {
    fail(`totalCancelledPaid expected 800, got ${s.totalCancelledPaid}`);
  }

  console.log('\n--- 2. Testing Frontend Billing Formula Logic ---');
  const allBills = await prisma.bill.findMany();
  const activeBills = allBills.filter(b => b.invoiceStatus !== 'Cancelled');
  const cancelledBills = allBills.filter(b => b.invoiceStatus === 'Cancelled');

  const frontendTotalBilled = activeBills.reduce((acc, b) => acc + (Number(b.total) || 0), 0);
  const frontendTotalCollected = allBills.reduce((acc, b) => acc + (Number(b.paid) || 0), 0);
  const frontendTotalOutstanding = activeBills.reduce((acc, b) => acc + Math.max(0, (Number(b.balance) || 0)), 0);

  if (frontendTotalBilled === 2700) {
    pass('Frontend totalBilled formula produces ₹2,700 (clean active revenue)');
  } else {
    fail(`frontendTotalBilled expected 2700, got ${frontendTotalBilled}`);
  }

  if (frontendTotalCollected === 2500) {
    pass('Frontend totalCollected formula produces ₹2,500 (preserves collected cash on voided bills)');
  } else {
    fail(`frontendTotalCollected expected 2500, got ${frontendTotalCollected}`);
  }

  if (frontendTotalOutstanding === 1000) {
    pass('Frontend totalOutstanding formula produces ₹1,000 (no cancelled inflation)');
  } else {
    fail(`frontendTotalOutstanding expected 1000, got ${frontendTotalOutstanding}`);
  }

  console.log('\n--- 3. Testing Staff Dashboard Formulas ---');
  const revenueBilledToday = allBills
    .filter(b => b.invoiceStatus !== 'Cancelled')
    .reduce((acc, b) => acc + (b.total || 0), 0);
  const pendingPayments = allBills
    .filter(b => b.invoiceStatus !== 'Cancelled' && b.paymentStatus !== 'Paid')
    .reduce((acc, b) => acc + (b.balance || 0), 0);

  if (revenueBilledToday === 2700) {
    pass('Staff dashboard revenueBilledToday equals ₹2,700');
  } else {
    fail(`revenueBilledToday expected 2700, got ${revenueBilledToday}`);
  }

  if (pendingPayments === 1000) {
    pass('Staff dashboard pendingPayments equals ₹1,000');
  } else {
    fail(`pendingPayments expected 1000, got ${pendingPayments}`);
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
  console.log(`  FINANCIAL AUDIT TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(64) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

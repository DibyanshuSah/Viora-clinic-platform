const assert = require('assert');
const app = require('./src/app');
const db = require('./src/config/database');
const http = require('http');

let server;
let port = 5055;
let baseUrl = `http://localhost:${port}/api/v1`;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${path}`);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runSystemVerification() {
  console.log('================================================================');
  console.log('  VIORA CMS: WHATSAPP INTEGRATION & SECURE ACCESS VERIFICATION  ');
  console.log('================================================================\n');

  // Start HTTP server on test port
  await new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`Test server running on port ${port}`);
      resolve();
    });
  });

  try {
    // 1. Authenticate as Staff and Admin
    console.log('[STEP 1] Authenticating Staff & Admin users...');
    const staffLogin = await request('POST', '/auth/login', { username: 'staff@reception', password: 'staff@123' });
    assert.strictEqual(staffLogin.status, 200, 'Staff login failed');
    const staffToken = staffLogin.body.data.token;

    const adminLogin = await request('POST', '/auth/login', { username: 'viora@admin', password: 'vioraclinic@2026' });
    assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
    const adminToken = adminLogin.body.data.token;
    console.log('✓ Staff & Admin authenticated successfully.\n');

    // 2. Patient Registration with WhatsApp validation & Consent
    console.log('[STEP 2] Testing Patient Registration with WhatsApp & Consent...');
    const regPayload = {
      name: 'Ananya Deshmukh',
      age: 32,
      gender: 'Female',
      phone: '+91 98451 22334',
      whatsappNumber: '+91 98451 22334',
      whatsappConsent: true,
      city: 'Bengaluru'
    };
    const regRes = await request('POST', '/patients', regPayload, { Authorization: `Bearer ${staffToken}` });
    assert.strictEqual(regRes.status, 201, 'Patient registration failed');
    const patient = regRes.body.data;
    assert.strictEqual(patient.whatsappNumber, '+919845122334', 'WhatsApp number should be formatted in E.164');
    assert.strictEqual(patient.whatsappConsent, true, 'WhatsApp consent must be stored as true');
    assert(patient.whatsappConsentDate, 'Consent date must be recorded');
    console.log(`✓ Patient ${patient.name} (${patient.patientId}) registered with WhatsApp consent.\n`);

    // 3. Create Appointment for patient
    console.log('[STEP 3] Scheduling visit appointment...');
    const aptRes = await request('POST', '/appointments', {
      patientId: patient.patientId,
      doctorId: 'DOC-101',
      appointmentType: 'Consultation',
      date: new Date().toISOString().split('T')[0],
      time: '11:30',
      status: 'Waiting'
    }, { Authorization: `Bearer ${staffToken}` });
    assert.strictEqual(aptRes.status, 201, 'Appointment creation failed');
    const appointment = aptRes.body.data;
    console.log(`✓ Appointment ${appointment.appointmentId} (${appointment.queueNumber}) booked in doctor queue.\n`);

    // 3b. Verify Doctor CANNOT end visit (403 Forbidden - "End" is strictly on staff side)
    const docLogin = await request('POST', '/auth/login', { username: 'doctor@viora', password: 'doctor@123' });
    assert.strictEqual(docLogin.status, 200, 'Doctor login failed');
    const docToken = docLogin.body.data.token;
    const docEndRes = await request('POST', `/appointments/${appointment.appointmentId}/end-visit`, {}, { Authorization: `Bearer ${docToken}` });
    assert.strictEqual(docEndRes.status, 403, 'Doctor must be forbidden from ending visit (End is strictly on staff side)');
    console.log('✓ RBAC verified: Doctor cannot end visit (403 Forbidden). Only Staff/Admin can end visit.\n');

    // 4. Staff Clicks "End" Button -> triggers automated bill finalization, UUID link, and WhatsApp thank-you message
    console.log('[STEP 4] Clicking "End" button to complete visit...');
    const endRes = await request('POST', `/appointments/${appointment.appointmentId}/end-visit`, {}, { Authorization: `Bearer ${staffToken}` });
    assert.strictEqual(endRes.status, 200, 'End visit workflow failed');
    const endData = endRes.body.data;

    // Verify 1: Appointment status completed
    assert.strictEqual(endData.appointment.status, 'Completed', 'Appointment status must be Completed');

    // Verify 2: Bill finalized
    assert(endData.bill, 'Bill must be finalized');
    assert(endData.bill.invoiceNumber, 'Invoice number must be generated');

    // Verify 3: Cryptographically secure UUID link generated
    assert(endData.link, 'UUID Bill Access Link must be generated');
    const token = endData.link.token;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert(uuidRegex.test(token), `Link token must be a cryptographically secure UUID v4: ${token}`);
    assert(endData.link.url.includes(`/view-bill/${token}`), 'Link URL must use UUID token without database IDs');

    // Verify 4: WhatsApp message dispatched
    assert(endData.whatsappMessage, 'WhatsApp message must be generated');
    assert(['Sent', 'Pending', 'Delivered'].includes(endData.whatsappMessage.status), `Message status valid: ${endData.whatsappMessage.status}`);
    assert(endData.whatsappMessage.messageBody.includes(endData.link.url), 'Message body must include secure bill URL');
    assert(endData.whatsappMessage.messageBody.includes('Thank you for visiting') && endData.whatsappMessage.messageBody.includes('VIORA Healthcare'), 'Mandated thank-you greeting must match');
    console.log(`✓ Visit completed:`);
    console.log(`   - Invoice Number: ${endData.bill.invoiceNumber}`);
    console.log(`   - Secure UUID Link: ${endData.link.url}`);
    console.log(`   - WhatsApp Message Status: ${endData.whatsappMessage.status}`);
    console.log(`   - Expiry Date: ${endData.link.expiresAt}\n`);

    // 5. Test Idempotency on repeated "End" clicks
    console.log('[STEP 5] Testing Idempotency on repeated clicks...');
    const billCount1 = db.bills.length;
    const msgCount1 = db.whatsappMessages.length;

    const repeatRes = await request('POST', `/appointments/${appointment.appointmentId}/end-visit`, {}, { Authorization: `Bearer ${staffToken}` });
    assert.strictEqual(repeatRes.status, 200);

    const billCount2 = db.bills.length;
    const msgCount2 = db.whatsappMessages.length;
    assert.strictEqual(billCount1, billCount2, 'Repeated clicks must NOT create duplicate bills');
    assert.strictEqual(msgCount1, msgCount2, 'Repeated clicks must NOT dispatch duplicate WhatsApp messages');
    console.log('✓ Idempotency verified: 0 duplicate bills, 0 duplicate WhatsApp messages created.\n');

    // 5b. Verify Editing Bill with Discount shows "Paid", not "Partially Paid"
    console.log('[STEP 5b] Testing Bill Editing with Discount...');
    const editBillRes = await request('PUT', `/billing/${endData.bill.billId}`, {
      discount: 200,
      procedures: [{ procedureId: 'PROC-101', name: 'Standard Procedure', price: 500, qty: 1 }]
    }, { Authorization: `Bearer ${staffToken}` });
    assert.strictEqual(editBillRes.status, 200, 'Bill edit request failed');
    assert.strictEqual(editBillRes.body.data.paymentStatus, 'Paid', 'Discounted bill must show "Paid", not "Partially Paid"');
    assert.strictEqual(editBillRes.body.data.balance, 0, 'Discounted bill balance must be 0');
    console.log(`✓ Bill edited with discount: status is "${editBillRes.body.data.paymentStatus}", balance is ₹${editBillRes.body.data.balance}.\n`);

    // 6. Patient Views Bill using UUID Link (Public Route - No Password Required)
    console.log('[STEP 6] Patient accessing bill via UUID link (/api/v1/public/bills/:token)...');
    const publicRes = await request('GET', `/public/bills/${token}`);
    assert.strictEqual(publicRes.status, 200, 'Public bill view request failed');
    const publicBill = publicRes.body.data;
    assert.strictEqual(publicBill.invoice.invoiceNumber, endData.bill.invoiceNumber, 'Must return the correct invoice');
    assert.strictEqual(publicBill.invoice.patientName, patient.name, 'Patient name displayed');
    assert(!publicBill.invoice.patientId, 'Sensitive patient internal DB ID must NOT be exposed in patient view');
    assert(publicBill.clinic, 'Clinic header credentials present');
    console.log(`✓ Patient securely viewed bill without login (Invoice: ${publicBill.invoice.invoiceNumber}).\n`);

    // 7. Security: Attempting to access invalid/random UUID
    console.log('[STEP 7] Security Test: Accessing invalid / non-existent UUID token...');
    const fakeToken = '00000000-0000-0000-0000-000000000000';
    const fakeRes = await request('GET', `/public/bills/${fakeToken}`);
    assert.strictEqual(fakeRes.status, 404, 'Non-existent token must return 404 Not Found');
    assert(!fakeRes.body.data, 'No bill data should be returned on invalid token');
    console.log('✓ Invalid UUID token rejected with 404 and zero data exposure.\n');

    // 8. Revocation Control: Authorized staff/admin revokes bill link
    console.log('[STEP 8] Testing Bill Link Revocation...');
    const revokeRes = await request('POST', `/billing/links/${endData.link.id}/revoke`, {}, { Authorization: `Bearer ${staffToken}` });
    assert.strictEqual(revokeRes.status, 200, 'Link revocation failed');
    assert.strictEqual(revokeRes.body.data.status, 'Revoked');

    // Attempt to access revoked link
    const revokedAccessRes = await request('GET', `/public/bills/${token}`);
    assert.strictEqual(revokedAccessRes.status, 410, 'Revoked link access must return HTTP 410 Gone');
    assert(!revokedAccessRes.body.data, 'No bill data must be exposed on revoked link');
    console.log(`✓ Revoked link returned HTTP 410 Gone with safe error: "${revokedAccessRes.body.message}".\n`);

    // 9. WhatsApp Delivery Failure & Staff Retry
    console.log('[STEP 9] Testing WhatsApp Failure Recording & Staff Retry...');
    // Simulate carrier failure on the message
    const msgRecord = db.whatsappMessages.find(m => m.id === endData.whatsappMessage.id);
    msgRecord.status = 'Failed';
    msgRecord.failureReason = 'Carrier unreachable (Simulated)';

    // Staff retries message
    const retryRes = await request('POST', `/billing/whatsapp/${msgRecord.id}/retry`, {}, { Authorization: `Bearer ${staffToken}` });
    assert.strictEqual(retryRes.status, 200, 'Message retry failed');
    assert.strictEqual(retryRes.body.data.retryCount, 1, 'Retry count must increment to 1');
    assert(['Sent', 'Pending'].includes(retryRes.body.data.status), 'Retried status must be updated');
    console.log(`✓ Message retried successfully (Retry count: ${retryRes.body.data.retryCount}, Status: ${retryRes.body.data.status}).\n`);

    // 10. Role-Based Access Control (RBAC) & System Audit Logs
    console.log('[STEP 10] Testing RBAC & System Audit Logs...');
    // Staff attempting to access Admin Audit Logs -> 403 Forbidden
    const forbiddenRes = await request('GET', '/admin/audit-logs', null, { Authorization: `Bearer ${staffToken}` });
    assert.strictEqual(forbiddenRes.status, 403, 'Staff must be blocked from admin audit logs with 403 Forbidden');
    console.log('✓ RBAC verified: Staff role blocked from Admin audit logs (403 Forbidden).');

    // Admin accessing Audit Logs -> 200 OK
    const auditRes = await request('GET', '/admin/audit-logs', null, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(auditRes.status, 200, 'Admin should access audit logs');
    const logs = auditRes.body.data.logs;
    assert(logs.length > 0, 'Audit logs must be populated');

    const loggedActions = logs.map(l => l.action);
    assert(loggedActions.includes('PATIENT_REGISTERED'), 'PATIENT_REGISTERED action logged');
    assert(loggedActions.includes('LINK_GENERATED'), 'LINK_GENERATED action logged');
    assert(loggedActions.includes('LINK_ACCESSED'), 'LINK_ACCESSED action logged');
    assert(loggedActions.includes('LINK_REVOKED'), 'LINK_REVOKED action logged');
    assert(loggedActions.includes('WHATSAPP_SENT'), 'WHATSAPP_SENT action logged');
    assert(loggedActions.includes('WHATSAPP_RETRIED'), 'WHATSAPP_RETRIED action logged');

    // Verify token redaction in logs: raw UUIDs must NOT be stored in audit log details
    const unredactedTokenFound = logs.some(l => l.details && l.details.includes(token));
    assert(!unredactedTokenFound, 'Raw UUID tokens must be redacted in audit logs');
    console.log('✓ System Audit Logs verified: All actions recorded with token redaction.\n');

    // 11. WhatsApp Settings Management by Admin
    console.log('[STEP 11] Testing Admin WhatsApp Settings...');
    const updateSettingsRes = await request('PUT', '/admin/whatsapp-settings', {
      whatsappDefaultExpiryDays: 14,
      whatsappAutoSendOnEnd: true
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(updateSettingsRes.status, 200);
    assert.strictEqual(updateSettingsRes.body.data.whatsappDefaultExpiryDays, 14, 'Default expiry days updated to 14');
    console.log('✓ Admin WhatsApp Settings updated successfully.\n');

    console.log('================================================================');
    console.log('  🎯 ALL 11 END-TO-END ACCEPTANCE CRITERIA PASSED SUCCESSFULLY!  ');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close(() => {
        process.exit(process.exitCode || 0);
      });
      // Fallback timer if connections linger
      setTimeout(() => process.exit(process.exitCode || 0), 1000);
    } else {
      process.exit(process.exitCode || 0);
    }
  }
}

runSystemVerification();

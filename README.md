# VIORA CLINIC MANAGEMENT SYSTEM

**VIORA** is a full-stack, enterprise-grade Clinic Management Web Application engineered for modern outpatient clinics, multi-specialty healthcare centres, and clinical practices. It features end-to-end clinical workflows, real-time queues, prescription generation, automated billing, and an enterprise WhatsApp Business Platform integration with cryptographic UUID bill links and zero-trust access control.

---

## 👥 Role-Based Workspaces & Key Features

### 1. 🛡️ ADMIN WORKSPACE (Indigo Accent)
* **Executive Dashboard**: Real-time KPIs (Patients today, Active doctors, Appointments, Billed Revenue, 7-Day Revenue Trend, Clinic Queue).
* **Doctor Management**: Create doctor accounts, credentials, assign specialization, configure working days, shift hours, break times, consultation rates, doctor payout cuts, and procedure cuts.
* **List Management**: Master clinical procedures catalog (ECG, Injections, Wound Care, Nebulization, Suturing, IV Infusions) with default pricing and physician splits.
* **Staff Management**: Receptionists, nursing staff, shift schedules (Morning, Evening, General, Night), hours tracking, and account credentials.
* **Analytics & Financials**: Period filters (Today, Week, Month, Custom), Gross Revenue vs Clinic Net Share, Consultation vs Procedure breakdown, Doctor Payout statement, and staff duty hours.
* **WhatsApp Cloud Platform Settings**: Configure Meta WhatsApp Phone Number ID, Access Token, Business Account ID, Webhook verify token, bill link default expiration days, and live Meta Graph API connection testing.
* **System Audit Logs**: Real-time audit log of patient registrations, visit completions, UUID bill link creations, patient accesses, revocations, and WhatsApp dispatches/retries (with automatic secret/token redaction).
* **Clinic Profile**: Dynamic VIORA branding, address, registration numbers, GSTIN, operating hours that auto-reflect across invoices and prescriptions.

### 2. 🩺 DOCTOR WORKSPACE (Blue Accent)
* **Clinical Appointments Queue**: Real-time queue (`Q-01`, `Q-02`, etc.), patient details, waiting time tracking, and instant consultation launcher. *(Note: Doctor pause appointment controls are eliminated in favor of Admin roster control).*
* **Assigned Patients**: Medical history, chronic conditions, and past consultations.
* **Dedicated 3-Column Consultation Window**:
  * **Left**: Patient Medical History, Drug Allergies (prominently highlighted), Previous Visits chronology.
  * **Center**: Vitals recording (BP, Pulse, Temp, Weight, SpO2), Chief Complaints, Examination findings, Diagnosis, In-clinic Procedures, and RX Medicine Builder (Medicine, Dosage, Frequency, Duration, Instructions).
  * **Right**: **Private Doctor Notes / Remarks** (Secured by backend RBAC; strictly inaccessible to Staff role).
* **Instant RX Generation**: Save, preview, print, and download prescriptions formatted with VIORA clinic credentials.
* **Consultation Save & Patient Handoff**: Doctors record diagnoses, vitals, prescriptions, and private notes with "Save Consultation". The patient is handed off to the Front Desk / Staff to finalize billing and end the visit.

### 3. 📋 STAFF / FRONT DESK WORKSPACE (Teal Accent)
* **Front Desk Command Centre**: Real-time queue, doctor roster loads, and one-click "End" actions right from the dashboard queue table.
* **Patient Registration with WhatsApp Consent**: Capture patient demographics, dedicated WhatsApp-enabled mobile phone field with 1-click sync, and explicit WhatsApp communication consent checkbox.
* **Connected Front Desk Workflow**:
  $$\text{Register Patient} \longrightarrow \text{Select Doctor \& Slot} \longrightarrow \text{Bill Line Items} \longrightarrow \text{Confirm \& Print Invoice}$$
  * **Register and Bill**: Single connected transaction to register demographics, assign doctor queue, and generate printable tax invoice.
* **One-Click "End" Visit Action**: Staff initiates the "End" visit workflow from the Dashboard Queue or Appointments table. This finalizes visit billing, generates a time-limited UUID bill link, and triggers automated WhatsApp dispatch with idempotency protection.
* **WhatsApp Delivery Status & Retry**: Real-time badges (`Pending`, `Sent`, `Delivered`, `Failed`) with 1-click retry capability and copyable secure link.
* **Bill Link Management**: View active and expired bill links, configure expiration, instantly revoke compromised links, and copy secure URLs.
* **Appointment Scheduling**: Only allows valid consultation types (`Consultation` or `Procedure`), validates doctor working days and shift hours.
* **Doctor Daily Schedules**: Visual schedule matrix with available slot calculations.
* **Billing & Invoicing**: Multi-item bills for consultations and procedures, discount/tax handling, payment methods (UPI, Cash, Card), and printable tax invoices with VIORA header.

### 4. 📱 PUBLIC PATIENT BILL PORTAL (Zero-Login / Token-Verified)
* **Route**: `/view-bill/:token` (or `/bill/access/:token`)
* **Secure Access**: Instant, authenticated access using cryptographically secure UUID tokens without requiring patient login or app downloads.
* **Data Privacy**: No database IDs, phone numbers, or invoice numbers exposed in URL or page headers.
* **Features**: Responsive mobile-friendly UI, clinic branding, detailed itemization, tax breakdown, payment status, printable/downloadable PDF-ready invoice, and security status banner.
* **Tamper Protection**: Accessing an expired, revoked, or non-existent token renders a secure `410 Gone` / `404 Not Found` state with zero data leakage.

---

## 💬 WhatsApp Integration & Automated Bill Workflow

### 1. Workflow Architecture
```
[Staff clicks "End" on Queue or Appointments]
            │
            ▼
[1. Finalize Bill & Status: Paid/Generated]
            │
            ▼
[2. Cryptographic UUID Token Generation]
    - crypto.randomUUID()
    - Configurable Expiry (e.g. 7 days)
    - Zero ID / Phone Exposure
            │
            ▼
[3. Idempotency Check & Transaction Guard]
    - Prevents duplicate bills on rapid multi-clicks
    - Prevents duplicate WhatsApp dispatches
            │
            ▼
[4. WhatsApp Business Platform Dispatch]
    - Meta Graph API v20.0
    - Exact Mandated Format:
      "Hello {{name}}! 👋
       Thank you for visiting **VIORA Healthcare!** 💚
       We hope you had a comfortable experience with us. Your bill is now available.
       📅 Visit Date: {{date}}
       🧾 View Your Bill: https://vioracare.in/view-bill/{uuid}
       *Your Health, Our Priority.*"
            │
            ▼
[5. Real-Time Tracking & Webhook Processing]
    - Statuses: Pending ➔ Sent ➔ Delivered (or Failed)
    - 1-Click Manual Retry for Failed Messages
```

### 2. UUID-Based Secure Bill Access Model
* **Cryptographic Randomness**: Every bill link uses Node `crypto.randomUUID()` (128-bit collision-resistant entropy).
* **Zero Sensitive Exposure**: No database IDs (`PAT-1001`, `BILL-2026-001`), phone numbers (`+91 98765 43210`), or invoice numbers (`INV-VIO-2026-0001`) exist in the URL query string or path parameters.
* **Rate Limiting**: Public bill access endpoint is guarded by a sliding window rate limiter (max 30 requests per minute per IP) to mitigate brute-force and scraping attempts.
* **Time-Limited Expiry**: Configured globally in Admin Settings or per-link (default: 7 days). Expired tokens return `HTTP 404 Not Found` with a safe front-desk guidance prompt.
* **Instant Revocation Control**: Authorized staff and administrators can revoke any link immediately from the Billing Management interface. Revoked tokens immediately return `HTTP 410 Gone`.

### 3. Role-Based Access Control (RBAC) & Audit Integrity
| Operation | Admin | Doctor | Staff / Receptionist | Patient (Public) |
| :--- | :---: | :---: | :---: | :---: |
| Register Patient & WhatsApp Number | ✅ | ❌ | ✅ | ❌ |
| End Visit & Auto-Trigger WhatsApp | ✅ | ❌ | ✅ | ❌ |
| View Patient Bill via Secure Link | ✅ | ✅ | ✅ | ✅ (Own Bill via Token) |
| Manage / Revoke Bill Links | ✅ | ❌ | ✅ | ❌ |
| Retry Failed WhatsApp Messages | ✅ | ❌ | ✅ | ❌ |
| View System Audit Logs | ✅ | ❌ | ❌ (403 Forbidden) | ❌ |
| Configure WhatsApp Cloud API Credentials | ✅ | ❌ | ❌ (403 Forbidden) | ❌ |

* **Redacted Audit Logging**: All sensitive lifecycle events (`PATIENT_REGISTERED`, `VISIT_ENDED`, `BILL_FINALIZED`, `LINK_GENERATED`, `LINK_ACCESSED`, `LINK_REVOKED`, `WHATSAPP_SENT`, `WHATSAPP_RETRIED`, `WHATSAPP_CONFIG_UPDATED`) are automatically scrubbed so that tokens and passwords never appear in cleartext logs.

---

## ⚙️ WhatsApp Business Platform (Meta Cloud API) Configuration

VIORA integrates directly with Meta's official WhatsApp Business Cloud API (`graph.facebook.com/v20.0`).

### 1. Meta Developer Setup
1. Log in to [Meta for Developers](https://developers.facebook.com/) and create a Business App.
2. Add the **WhatsApp** product to your application.
3. In the WhatsApp API Setup panel, copy:
   * **Phone Number ID**: Identifies your clinic's WhatsApp sending number.
   * **Temporary / System User Access Token**: Bearer token with `whatsapp_business_messaging` permissions.
   * **WhatsApp Business Account ID (WABA ID)**: Your clinic's Meta business account.

### 2. Configure in VIORA
You can configure credentials via environment variables or through the Admin UI:

#### Option A: Via `.env` (Backend)
Edit `backend/.env`:
```env
WHATSAPP_API_URL=https://graph.facebook.com/v20.0
WHATSAPP_PHONE_NUMBER_ID=100000000000000
WHATSAPP_ACCESS_TOKEN=EAABxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_BUSINESS_ACCOUNT_ID=200000000000000
WHATSAPP_WEBHOOK_VERIFY_TOKEN=viora_webhook_secret_verify_token_2026
BILL_LINK_EXPIRY_DAYS=7
APP_BASE_URL=https://vioracare.in
```

#### Option B: Via Admin Settings Workspace
1. Log into the VIORA Admin Portal.
2. Navigate to **Settings** (`/admin/settings`).
3. Scroll to **WhatsApp Business Platform Configuration**.
4. Enter Phone Number ID, Access Token, and Business Account ID.
5. Click **Test WhatsApp Connection** to verify live communication with Meta Graph API.
6. Click **Save Configuration**.

### 3. Webhook Delivery Receipt Setup
1. In Meta Developer Console, go to **WhatsApp > Configuration > Webhooks**.
2. Set Callback URL: `https://vioracare.in/api/v1/whatsapp/webhook`
3. Set Verify Token: Match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (default: `viora_webhook_secret_verify_token_2026`).
4. Subscribe to the `messages` event.
5. When patients receive or read messages, VIORA updates the status in real time to `Delivered` or `Read`.

> [!NOTE]
> If Meta API credentials are not yet configured or left empty, VIORA automatically operates in seamless development fallback mode (messages are securely logged as `Sent` with full delivery and retry tracking preserved without interrupting patient checkout).

---

## 🎨 Strict Mandated Color Palette

* **Surfaces**: `--bg-app: #F8FAFC`, `--bg-surface: #FFFFFF`, `--bg-sidebar: #0F172A`, `--border-subtle: #E2E8F0`
* **Typography**: `--text-main: #0F172A`, `--text-secondary: #475569`, `--text-muted: #94A3B8`, `--text-inverse: #FFFFFF`
* **Admin**: `--role-admin-primary: #4F46E5`, `--role-admin-hover: #4338CA`, `--role-admin-bg: #EEF2FF`
* **Doctor**: `--role-doctor-primary: #0284C7`, `--role-doctor-hover: #0369A1`, `--role-doctor-bg: #E0F2FE`
* **Staff**: `--role-staff-primary: #0D9488`, `--role-staff-hover: #0F766E`, `--role-staff-bg: #CCFBF1`

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v18+ (tested on v24)
* **npm**: v9+

### 1. Install All Dependencies
From the root directory:
```bash
npm run install:all
```
Or install in each directory:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Run Complete Verification Test Suite
Run the automated 11-step end-to-end verification test:
```bash
npm --prefix backend test
```
Tests:
* Patient registration with validated WhatsApp numbers & consent.
* Appointment scheduling and visit "End" trigger.
* Automatic bill finalization, UUID generation, and WhatsApp dispatch.
* Multi-click idempotency (duplicate prevention).
* Secure public bill viewing via UUID token without authentication.
* Rejection of invalid UUID tokens with zero data leakage.
* Instant link revocation returning `HTTP 410 Gone`.
* WhatsApp failure logging and staff retry mechanism.
* RBAC enforcement (Staff blocked from admin logs with `HTTP 403`).
* Audit logs with automatic token redaction.
* Admin WhatsApp settings updates.

### 3. Start Both Services Concurrently
From root directory:
```bash
npm run dev
```

* Production Deployed App: `https://vioracare.in`
* Patient Bill Viewer (Production): `https://vioracare.in/view-bill/:token`
* Local Backend API: `http://localhost:5000`
* Local Frontend App: `http://localhost:5173`
* Local Patient Bill Viewer: `http://localhost:5173/view-bill/:token`

*(You can also use the convenient **Demo Mode** buttons on the Login page or in the Sidebar to switch workspaces with one click).*

---

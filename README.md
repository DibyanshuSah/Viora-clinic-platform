# VIORA CLINIC MANAGEMENT SYSTEM

**VIORA** is a full-stack, enterprise-grade Clinic Management Web Application engineered for modern outpatient clinics, multi-specialty healthcare centres, and clinical practices.

---

## 👥 Role-Based Workspaces & Key Features

### 1. 🛡️ ADMIN WORKSPACE (Indigo Accent)
* **Executive Dashboard**: Real-time KPIs (Patients today, Active doctors, Appointments, Billed Revenue, 7-Day Revenue Trend, Clinic Queue).
* **Doctor Management**: Create doctor accounts, credentials, assign specialization, configure working days, shift hours, break times, consultation rates, doctor payout cuts, and procedure cuts.
* **List Management**: Master clinical procedures catalog (ECG, Injections, Wound Care, Nebulization, Suturing, IV Infusions) with default pricing and physician splits.
* **Staff Management**: Receptionists, nursing staff, shift schedules (Morning, Evening, General, Night), hours tracking, and account credentials.
* **Analytics & Financials**: Period filters (Today, Week, Month, Custom), Gross Revenue vs Clinic Net Share, Consultation vs Procedure breakdown, Doctor Payout statement, and staff duty hours.
* **Clinic Profile**: Dynamic VIORA branding, address, registration numbers, GSTIN, operating hours that auto-reflect across invoices and prescriptions.

### 2. 🩺 DOCTOR WORKSPACE (Blue Accent)
* **Clinical Appointments Queue**: Real-time queue (`Q-01`, `Q-02`, etc.), patient details, waiting time tracking, and instant consultation launcher. *(Note: Doctor pause appointment controls are eliminated in favor of Admin roster control).*
* **Assigned Patients**: Medical history, chronic conditions, and past consultations.
* **Dedicated 3-Column Consultation Window**:
  * **Left**: Patient Medical History, Drug Allergies (prominently highlighted), Previous Visits chronology.
  * **Center**: Vitals recording (BP, Pulse, Temp, Weight, SpO2), Chief Complaints, Examination findings, Diagnosis, In-clinic Procedures, and RX Medicine Builder (Medicine, Dosage, Frequency, Duration, Instructions).
  * **Right**: **Private Doctor Notes / Remarks** (Secured by backend RBAC; strictly inaccessible to Staff role).
* **Instant RX Generation**: Save, preview, print, and download prescriptions formatted with VIORA clinic credentials.

### 3. 📋 STAFF / FRONT DESK WORKSPACE (Teal Accent)
* **Front Desk Command Centre**: Real-time queue, doctor roster loads, quick actions.
* **Connected Front Desk Workflow**:
  $$\text{Register Patient} \longrightarrow \text{Select Doctor \& Slot} \longrightarrow \text{Bill Line Items} \longrightarrow \text{Confirm \& Print Invoice}$$
  * **Register and Bill**: Single connected transaction to register demographics, assign doctor queue, and generate printable tax invoice.
* **Appointment Scheduling**: Only allows valid consultation types (`Consultation` or `Procedure`), validates doctor working days and shift hours.
* **Doctor Daily Schedules**: Visual schedule matrix with available slot calculations.
* **Billing & Invoicing**: Multi-item bills for consultations and procedures, discount/tax handling, payment methods (UPI, Cash, Card), and printable tax invoices with VIORA header.

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

### 2. Start Both Services Concurrently
From root directory:
```bash
npm run dev
```
* **Frontend**: http://localhost:5173
* **Backend API**: http://localhost:5000/api/v1

### 3. Demo Credentials

| Role | Username | Password | Default Landing Page |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin` | `admin123` | `/admin/dashboard` |
| **DOCTOR** | `dr.sharma` | `doctor123` | `/doctor/appointments` |
| **DOCTOR** | `dr.ananya` | `doctor123` | `/doctor/appointments` |
| **DOCTOR** | `dr.vikram` | `doctor123` | `/doctor/appointments` |
| **STAFF** | `staff1` | `staff123` | `/staff/dashboard` |
| **STAFF** | `staff2` | `staff123` | `/staff/dashboard` |

*(You can also use the convenient **Demo Mode** buttons on the Login page or in the Sidebar to switch workspaces with one click).*

---

## 🔒 Security & RBAC Enforcement

* All endpoints under `/api/v1/admin` and `/api/v1/analytics` are protected with JWT authentication and strict `ADMIN` role middleware (returns `403 Forbidden` for other roles).
* Doctor Private Notes are filtered out from responses sent to Staff roles.
* Password hashes are stripped before sending user payloads over the wire.

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "referenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "clinic_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'viora-primary',
    "clinicName" TEXT NOT NULL DEFAULT 'VIORA',
    "tagline" TEXT NOT NULL DEFAULT 'Advanced Clinic & Healthcare Centre',
    "logoUrl" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Bengaluru',
    "state" TEXT NOT NULL DEFAULT 'Karnataka',
    "pinCode" TEXT NOT NULL DEFAULT '560034',
    "contactNumber" TEXT NOT NULL DEFAULT '+91 80 4920 8800',
    "email" TEXT NOT NULL DEFAULT 'contact@vioraclinic.com',
    "website" TEXT NOT NULL DEFAULT 'https://vioracare.in',
    "registrationNumber" TEXT NOT NULL DEFAULT 'KA-MED-2024-88421',
    "gstNumber" TEXT NOT NULL DEFAULT '29AABCU9603R1ZM',
    "openingTime" TEXT NOT NULL DEFAULT '08:00 AM',
    "closingTime" TEXT NOT NULL DEFAULT '08:00 PM',
    "currency" TEXT NOT NULL DEFAULT 'Γé╣',
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappApiUrl" TEXT NOT NULL DEFAULT 'https://graph.facebook.com/v20.0',
    "whatsappPhoneNumberId" TEXT,
    "whatsappBusinessAccountId" TEXT,
    "whatsappAccessToken" TEXT,
    "whatsappDefaultExpiryDays" INTEGER NOT NULL DEFAULT 7,
    "whatsappAutoSendOnEnd" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "doctors" (
    "doctorId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'Other',
    "specialization" TEXT NOT NULL,
    "qualification" TEXT NOT NULL DEFAULT '',
    "registrationNumber" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consultationRates" TEXT NOT NULL,
    "procedureRates" TEXT NOT NULL DEFAULT '{}',
    "workingDays" TEXT NOT NULL,
    "workingHours" TEXT NOT NULL,
    "breakTimes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "staff" (
    "staffId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'Morning Shift',
    "workingDays" TEXT NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT NOT NULL DEFAULT '14:00',
    "scheduledHours" REAL NOT NULL DEFAULT 6,
    "workedHours" REAL NOT NULL DEFAULT 6,
    "attendance" TEXT NOT NULL DEFAULT 'Present',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "procedures" (
    "procedureId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultPrice" REAL NOT NULL,
    "defaultDoctorCut" REAL NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "patients" (
    "patientId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'Other',
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Bengaluru',
    "state" TEXT NOT NULL DEFAULT 'Karnataka',
    "pinCode" TEXT,
    "allergies" TEXT NOT NULL DEFAULT 'None',
    "medicalHistory" TEXT NOT NULL DEFAULT 'None',
    "emergencyContact" TEXT,
    "whatsappNumber" TEXT,
    "whatsappConsent" BOOLEAN NOT NULL DEFAULT true,
    "whatsappConsentDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "appointments" (
    "appointmentId" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentType" TEXT NOT NULL DEFAULT 'Consultation',
    "procedureId" TEXT,
    "procedureName" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Waiting',
    "queueNumber" TEXT NOT NULL DEFAULT 'Q-01',
    "waitingTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT 'Front Desk Staff',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients" ("patientId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors" ("doctorId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "consultations" (
    "consultationId" TEXT NOT NULL PRIMARY KEY,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "chiefComplaint" TEXT NOT NULL DEFAULT '',
    "symptoms" TEXT NOT NULL DEFAULT '',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "vitals" TEXT NOT NULL DEFAULT '{}',
    "examination" TEXT NOT NULL DEFAULT '',
    "treatment" TEXT NOT NULL DEFAULT '',
    "procedureDetails" TEXT NOT NULL DEFAULT '',
    "privateNotes" TEXT NOT NULL DEFAULT '',
    "prescriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Completed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "consultations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients" ("patientId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "consultations_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors" ("doctorId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "consultations_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments" ("appointmentId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "consultations_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions" ("prescriptionId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "prescriptionId" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "medicines" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "advice" TEXT NOT NULL DEFAULT '',
    "followUpDate" TEXT,
    "procedures" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients" ("patientId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors" ("doctorId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bills" (
    "billId" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "consultationType" TEXT NOT NULL DEFAULT 'Consultation',
    "consultationFee" REAL NOT NULL DEFAULT 0,
    "doctorCutConsultation" REAL NOT NULL DEFAULT 0,
    "clinicShareConsultation" REAL NOT NULL DEFAULT 0,
    "procedures" TEXT NOT NULL DEFAULT '[]',
    "subtotal" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "paid" REAL NOT NULL DEFAULT 0,
    "balance" REAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "paymentStatus" TEXT NOT NULL DEFAULT 'Paid',
    "doctorCutTotal" REAL NOT NULL DEFAULT 0,
    "clinicShareTotal" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT 'Front Desk Staff',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bills_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients" ("patientId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bills_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors" ("doctorId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bills_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments" ("appointmentId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bill_access_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bill_access_links_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills" ("billId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bill_access_links_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients" ("patientId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointmentId" TEXT,
    "billId" TEXT,
    "patientId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "secureLinkUrl" TEXT,
    "billAccessLinkId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "externalMessageId" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "failedAt" DATETIME,
    "lastRetriedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "whatsapp_messages_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills" ("billId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_messages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients" ("patientId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "patientId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_userId_key" ON "doctors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_username_key" ON "staff"("username");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_appointmentId_key" ON "consultations"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_prescriptionId_key" ON "consultations"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_consultationId_key" ON "prescriptions"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "bills_invoiceNumber_key" ON "bills"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bills_appointmentId_key" ON "bills"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "bill_access_links_token_key" ON "bill_access_links"("token");


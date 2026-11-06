-- CreateTable
CREATE TABLE "id_sequences" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "currentVal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_bills" (
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
    "invoiceStatus" TEXT NOT NULL DEFAULT 'Active',
    "doctorCutTotal" REAL NOT NULL DEFAULT 0,
    "clinicShareTotal" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT 'Front Desk Staff',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bills_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients" ("patientId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bills_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors" ("doctorId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bills_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments" ("appointmentId") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_bills" (
    "appointmentId", "balance", "billId", "clinicShareConsultation", "clinicShareTotal", 
    "consultationFee", "consultationType", "createdAt", "createdBy", "discount", 
    "doctorCutConsultation", "doctorCutTotal", "doctorId", "invoiceNumber", "paid", 
    "patientId", "paymentMethod", "paymentStatus", "invoiceStatus", "procedures", 
    "subtotal", "tax", "total", "updatedAt"
) 
SELECT 
    "appointmentId", "balance", "billId", "clinicShareConsultation", "clinicShareTotal", 
    "consultationFee", "consultationType", "createdAt", "createdBy", "discount", 
    "doctorCutConsultation", "doctorCutTotal", "doctorId", "invoiceNumber", "paid", 
    "patientId", "paymentMethod", 
    CASE 
        WHEN "paymentStatus" = 'Cancelled' THEN 
            CASE 
                WHEN "paid" >= "total" AND "total" > 0 THEN 'Paid'
                WHEN "paid" > 0 THEN 'Partially Paid'
                ELSE 'Pending'
            END
        ELSE "paymentStatus" 
    END,
    CASE 
        WHEN "paymentStatus" = 'Cancelled' THEN 'Cancelled' 
        ELSE 'Active' 
    END,
    "procedures", "subtotal", "tax", "total", "updatedAt" 
FROM "bills";

DROP TABLE "bills";
ALTER TABLE "new_bills" RENAME TO "bills";
CREATE UNIQUE INDEX "bills_invoiceNumber_key" ON "bills"("invoiceNumber");
CREATE UNIQUE INDEX "bills_appointmentId_key" ON "bills"("appointmentId");

CREATE TABLE "new_clinic_profiles" (
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
    "currency" TEXT NOT NULL DEFAULT '₹',
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

INSERT INTO "new_clinic_profiles" (
    "address", "city", "clinicName", "closingTime", "contactNumber", "createdAt", 
    "currency", "email", "gstNumber", "id", "logoUrl", "openingTime", "pinCode", 
    "registrationNumber", "state", "tagline", "updatedAt", "website", 
    "whatsappAccessToken", "whatsappApiUrl", "whatsappAutoSendOnEnd", 
    "whatsappBusinessAccountId", "whatsappDefaultExpiryDays", "whatsappEnabled", 
    "whatsappPhoneNumberId"
) 
SELECT 
    "address", "city", "clinicName", "closingTime", "contactNumber", "createdAt", 
    CASE WHEN "currency" = 'Γé╣' THEN '₹' ELSE "currency" END, 
    "email", "gstNumber", "id", "logoUrl", "openingTime", "pinCode", 
    "registrationNumber", "state", "tagline", "updatedAt", "website", 
    "whatsappAccessToken", "whatsappApiUrl", "whatsappAutoSendOnEnd", 
    "whatsappBusinessAccountId", "whatsappDefaultExpiryDays", "whatsappEnabled", 
    "whatsappPhoneNumberId" 
FROM "clinic_profiles";

DROP TABLE "clinic_profiles";
ALTER TABLE "new_clinic_profiles" RENAME TO "clinic_profiles";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

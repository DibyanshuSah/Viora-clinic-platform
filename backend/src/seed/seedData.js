const bcrypt = require('bcryptjs');

const salt = bcrypt.genSaltSync(10);
const hashPassword = (password) => bcrypt.hashSync(password, salt);

const todayStr = new Date().toISOString().split('T')[0];

const clinicProfileSeed = {
  clinicName: "VIORA",
  tagline: "Advanced Clinic & Healthcare Centre",
  logoUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150&auto=format&fit=crop&q=80",
  address: "42, Health Crest Boulevard, Medical Enclave, 4th Block, Koramangala",
  city: "Bengaluru",
  state: "Karnataka",
  pinCode: "560034",
  contactNumber: "+91 80 4920 8800",
  email: "contact@vioraclinic.com",
  website: "https://vioraclinic.com",
  registrationNumber: "KA-MED-2024-88421",
  gstNumber: "29AABCU9603R1ZM",
  openingTime: "08:00 AM",
  closingTime: "08:00 PM",
  currency: "₹",
  whatsappEnabled: true,
  whatsappApiUrl: "https://graph.facebook.com/v20.0",
  whatsappPhoneNumberId: "1040625662463775",
  whatsappBusinessAccountId: "1492899709117549",
  whatsappAccessToken: "EAARxMZCZA6y6cBSuE6nTI3ZAdIVYwIJkzKF6H3s92UuFzblO3sCrDxwT3HlLBja8ZBnl9Umg9tcZALuqIACfbGNmNSVwiC7fLpwxNhN2SWTf8hDMRfz3sNNBIJuJkGcUpf0x39zDSFfZBGrueQ26Ts5CTNzBwl4BmaTcURfg7zlm3FanlZAE7Eq6FV55X3mTXiRRwZDZD",
  whatsappDefaultExpiryDays: 365,
  whatsappAutoSendOnEnd: true
};

const usersSeed = [
  {
    id: "usr-admin-1",
    username: "viora@admin",
    password: hashPassword("vioraclinic@2026"),
    role: "ADMIN",
    name: "Administrator",
    email: "admin@vioraclinic.com",
    phone: "+91 98800 11223",
    status: "Active"
  },
  {
    id: "usr-doctor-1",
    username: "doctor@viora",
    password: hashPassword("doctor@123"),
    role: "DOCTOR",
    name: "Dr. Arun Venkatesh",
    email: "dr.arun@vioraclinic.com",
    phone: "+91 98440 22334",
    referenceId: "DOC-101",
    status: "Active"
  },
  {
    id: "usr-staff-1",
    username: "staff@reception",
    password: hashPassword("staff@123"),
    role: "STAFF",
    name: "Pooja Sharma",
    email: "pooja.reception@vioraclinic.com",
    phone: "+91 98450 88991",
    referenceId: "STF-201",
    status: "Active"
  }
];

const doctorsSeed = [
  {
    doctorId: "DOC-101",
    userId: "usr-doctor-1",
    name: "Dr. Arun Venkatesh",
    gender: "Male",
    specialization: "General Physician & Internal Medicine",
    qualification: "MBBS, MD (General Medicine)",
    registrationNumber: "KMC-48291",
    phone: "+91 98440 22334",
    email: "dr.arun@vioraclinic.com",
    consultationRates: {
      consultationFee: 800,
      doctorCut: 500,
      clinicShare: 300
    },
    procedureRates: {},
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    workingHours: { start: "09:00", end: "18:00" },
    breakTimes: { start: "13:00", end: "14:00" },
    status: "Active",
    createdAt: new Date().toISOString()
  }
];

const staffSeed = [
  {
    staffId: "STF-201",
    userId: "usr-staff-1",
    name: "Pooja Sharma",
    phone: "+91 98450 88991",
    email: "pooja.reception@vioraclinic.com",
    username: "staff@reception",
    shift: "Morning",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    startTime: "08:00",
    endTime: "16:00",
    scheduledHours: 48,
    workedHours: 46,
    attendance: "Present",
    status: "Active"
  }
];

const proceduresSeed = [
  {
    procedureId: "PROC-001",
    name: "Intramuscular / IV Injection",
    defaultPrice: 150,
    defaultDoctorCut: 50,
    description: "Sterile single dose parenteral administration with disposable syringe",
    status: "Active"
  },
  {
    procedureId: "PROC-002",
    name: "Dressing & Wound Care",
    defaultPrice: 350,
    defaultDoctorCut: 150,
    description: "Antiseptic cleaning, debridement and sterile bandage dressing",
    status: "Active"
  },
  {
    procedureId: "PROC-003",
    name: "Nebulization Session",
    defaultPrice: 250,
    defaultDoctorCut: 80,
    description: "Aerosol bronchodilator therapy (Duolin / Budecort) for respiratory relief",
    status: "Active"
  },
  {
    procedureId: "PROC-004",
    name: "12-Lead Electrocardiogram (ECG)",
    defaultPrice: 500,
    defaultDoctorCut: 250,
    description: "High resolution digital 12-channel rhythm and cardiac trace with physician interpretation",
    status: "Active"
  },
  {
    procedureId: "PROC-005",
    name: "Minor Skin Suture / Excision",
    defaultPrice: 1200,
    defaultDoctorCut: 600,
    description: "Local anaesthesia infiltration, minor laceration suturing or skin lesion removal",
    status: "Active"
  },
  {
    procedureId: "PROC-006",
    name: "IV Infusion Therapy (500ml)",
    defaultPrice: 450,
    defaultDoctorCut: 150,
    description: "Normal Saline / Ringer Lactate intravenous rehydration therapy under monitoring",
    status: "Active"
  },
  {
    procedureId: "PROC-007",
    name: "Random Blood Sugar (Glucometer)",
    defaultPrice: 100,
    defaultDoctorCut: 30,
    description: "Immediate capillary blood glucose screening test",
    status: "Active"
  }
];

const patientsSeed = [
  {
    patientId: "PAT-1001",
    name: "Rajeshwari Kulkarni",
    dateOfBirth: "1978-04-15",
    age: 48,
    gender: "Female",
    phone: "+91 98450 12345",
    email: "rajeshwari.k@example.com",
    whatsappNumber: "+91 98450 12345",
    whatsappConsent: true,
    whatsappConsentDate: new Date().toISOString(),
    address: "Flat 4B, Greenwood Apartments, 5th Main",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560034",
    allergies: "Penicillin",
    medicalHistory: "Type 2 Diabetes, Mild Hypertension",
    emergencyContact: "+91 98450 99887",
    createdAt: new Date().toISOString()
  }
];

const appointmentsSeed = [
  {
    appointmentId: "APT-2026-001",
    patientId: "PAT-1001",
    doctorId: "DOC-101",
    appointmentType: "Consultation",
    procedureId: null,
    procedureName: null,
    date: todayStr,
    time: "10:00",
    status: "Waiting",
    queueNumber: "Q-01",
    waitingTimeMinutes: 10,
    createdBy: "Pooja Sharma (STAFF)",
    createdAt: new Date().toISOString()
  }
];

const consultationsSeed = [];

const prescriptionsSeed = [];

const billsSeed = [];

module.exports = {
  clinicProfileSeed,
  usersSeed,
  doctorsSeed,
  staffSeed,
  proceduresSeed,
  patientsSeed,
  appointmentsSeed,
  consultationsSeed,
  prescriptionsSeed,
  billsSeed
};

const { PrismaClient } = require('@prisma/client');
const {
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
} = require('../src/seed/seedData');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding VIORA Prisma Database ---');

  // 1. Seed Clinic Profile
  await prisma.clinicProfile.upsert({
    where: { id: 'viora-primary' },
    update: clinicProfileSeed,
    create: {
      id: 'viora-primary',
      ...clinicProfileSeed
    }
  });
  console.log('✔ Clinic Profile seeded');

  // 2. Seed Users
  for (const u of usersSeed) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        referenceId: u.referenceId || null
      },
      create: {
        id: u.id,
        username: u.username,
        password: u.password,
        role: u.role,
        name: u.name,
        email: u.email,
        phone: u.phone,
        referenceId: u.referenceId || null,
        status: u.status
      }
    });
  }
  console.log(`✔ ${usersSeed.length} Users seeded`);

  // 3. Seed Doctors
  for (const doc of doctorsSeed) {
    await prisma.doctor.upsert({
      where: { doctorId: doc.doctorId },
      update: {
        name: doc.name,
        gender: doc.gender,
        specialization: doc.specialization,
        qualification: doc.qualification,
        registrationNumber: doc.registrationNumber,
        phone: doc.phone,
        email: doc.email,
        consultationRates: JSON.stringify(doc.consultationRates),
        procedureRates: JSON.stringify(doc.procedureRates || {}),
        workingDays: JSON.stringify(doc.workingDays),
        workingHours: JSON.stringify(doc.workingHours),
        breakTimes: JSON.stringify(doc.breakTimes),
        status: doc.status
      },
      create: {
        doctorId: doc.doctorId,
        userId: doc.userId,
        name: doc.name,
        gender: doc.gender,
        specialization: doc.specialization,
        qualification: doc.qualification,
        registrationNumber: doc.registrationNumber,
        phone: doc.phone,
        email: doc.email,
        consultationRates: JSON.stringify(doc.consultationRates),
        procedureRates: JSON.stringify(doc.procedureRates || {}),
        workingDays: JSON.stringify(doc.workingDays),
        workingHours: JSON.stringify(doc.workingHours),
        breakTimes: JSON.stringify(doc.breakTimes),
        status: doc.status
      }
    });
  }
  console.log(`✔ ${doctorsSeed.length} Doctors seeded`);

  // 4. Seed Staff
  for (const st of staffSeed) {
    await prisma.staff.upsert({
      where: { staffId: st.staffId },
      update: {
        name: st.name,
        phone: st.phone,
        email: st.email,
        shift: st.shift,
        workingDays: JSON.stringify(st.workingDays),
        startTime: st.startTime,
        endTime: st.endTime,
        scheduledHours: st.scheduledHours,
        workedHours: st.workedHours,
        attendance: st.attendance,
        status: st.status
      },
      create: {
        staffId: st.staffId,
        userId: st.userId,
        name: st.name,
        phone: st.phone,
        email: st.email,
        username: st.username,
        shift: st.shift,
        workingDays: JSON.stringify(st.workingDays),
        startTime: st.startTime,
        endTime: st.endTime,
        scheduledHours: st.scheduledHours,
        workedHours: st.workedHours,
        attendance: st.attendance,
        status: st.status
      }
    });
  }
  console.log(`✔ ${staffSeed.length} Staff members seeded`);

  // 5. Seed Procedures Catalog
  for (const p of proceduresSeed) {
    await prisma.procedure.upsert({
      where: { procedureId: p.procedureId },
      update: {
        name: p.name,
        defaultPrice: p.defaultPrice,
        defaultDoctorCut: p.defaultDoctorCut,
        description: p.description,
        status: p.status
      },
      create: {
        procedureId: p.procedureId,
        name: p.name,
        defaultPrice: p.defaultPrice,
        defaultDoctorCut: p.defaultDoctorCut,
        description: p.description,
        status: p.status
      }
    });
  }
  console.log(`✔ ${proceduresSeed.length} Procedures seeded`);

  // 6. Seed Patients
  for (const pat of patientsSeed) {
    await prisma.patient.upsert({
      where: { patientId: pat.patientId },
      update: {
        name: pat.name,
        dateOfBirth: pat.dateOfBirth,
        age: pat.age,
        gender: pat.gender,
        phone: pat.phone,
        email: pat.email,
        address: pat.address,
        city: pat.city,
        state: pat.state,
        pinCode: pat.pinCode,
        allergies: pat.allergies,
        medicalHistory: pat.medicalHistory,
        emergencyContact: pat.emergencyContact
      },
      create: {
        patientId: pat.patientId,
        name: pat.name,
        dateOfBirth: pat.dateOfBirth,
        age: pat.age,
        gender: pat.gender,
        phone: pat.phone,
        email: pat.email,
        address: pat.address,
        city: pat.city,
        state: pat.state,
        pinCode: pat.pinCode,
        allergies: pat.allergies,
        medicalHistory: pat.medicalHistory,
        emergencyContact: pat.emergencyContact
      }
    });
  }
  console.log(`✔ ${patientsSeed.length} Patients seeded`);

  // 7. Seed Appointments
  for (const apt of appointmentsSeed) {
    await prisma.appointment.upsert({
      where: { appointmentId: apt.appointmentId },
      update: {
        appointmentType: apt.appointmentType,
        procedureId: apt.procedureId || null,
        procedureName: apt.procedureName || null,
        date: apt.date,
        time: apt.time,
        status: apt.status,
        queueNumber: apt.queueNumber,
        waitingTimeMinutes: apt.waitingTimeMinutes || 0
      },
      create: {
        appointmentId: apt.appointmentId,
        patientId: apt.patientId,
        doctorId: apt.doctorId,
        appointmentType: apt.appointmentType,
        procedureId: apt.procedureId || null,
        procedureName: apt.procedureName || null,
        date: apt.date,
        time: apt.time,
        status: apt.status,
        queueNumber: apt.queueNumber,
        waitingTimeMinutes: apt.waitingTimeMinutes || 0
      }
    });
  }
  console.log(`✔ ${appointmentsSeed.length} Appointments seeded`);

  // 8. Seed Consultations
  for (const cns of consultationsSeed) {
    await prisma.consultation.upsert({
      where: { consultationId: cns.consultationId },
      update: {
        chiefComplaint: cns.chiefComplaint,
        symptoms: cns.symptoms,
        diagnosis: cns.diagnosis,
        vitals: JSON.stringify(cns.vitals || {}),
        examination: cns.examination,
        treatment: cns.treatment,
        procedureDetails: cns.procedureDetails,
        privateNotes: cns.privateNotes,
        status: cns.status
      },
      create: {
        consultationId: cns.consultationId,
        appointmentId: cns.appointmentId || null,
        patientId: cns.patientId,
        doctorId: cns.doctorId,
        chiefComplaint: cns.chiefComplaint,
        symptoms: cns.symptoms,
        diagnosis: cns.diagnosis,
        vitals: JSON.stringify(cns.vitals || {}),
        examination: cns.examination,
        treatment: cns.treatment,
        procedureDetails: cns.procedureDetails,
        privateNotes: cns.privateNotes,
        status: cns.status
      }
    });
  }
  console.log(`✔ ${consultationsSeed.length} Consultations seeded`);

  // 9. Seed Prescriptions
  for (const rx of prescriptionsSeed) {
    await prisma.prescription.upsert({
      where: { prescriptionId: rx.prescriptionId },
      update: {
        medicines: JSON.stringify(rx.medicines || []),
        diagnosis: rx.diagnosis,
        advice: rx.advice,
        followUpDate: rx.followUpDate,
        procedures: JSON.stringify(rx.procedures || [])
      },
      create: {
        prescriptionId: rx.prescriptionId,
        consultationId: rx.consultationId || null,
        patientId: rx.patientId,
        doctorId: rx.doctorId,
        medicines: JSON.stringify(rx.medicines || []),
        diagnosis: rx.diagnosis,
        advice: rx.advice,
        followUpDate: rx.followUpDate,
        procedures: JSON.stringify(rx.procedures || [])
      }
    });
  }
  console.log(`✔ ${prescriptionsSeed.length} Prescriptions seeded`);

  // 10. Seed Bills
  for (const b of billsSeed) {
    await prisma.bill.upsert({
      where: { billId: b.billId },
      update: {
        invoiceNumber: b.invoiceNumber,
        consultationType: b.consultationType,
        consultationFee: b.consultationFee,
        doctorCutConsultation: b.doctorCutConsultation,
        clinicShareConsultation: b.clinicShareConsultation,
        procedures: JSON.stringify(b.procedures || []),
        subtotal: b.subtotal,
        discount: b.discount,
        tax: b.tax,
        total: b.total,
        paid: b.paid,
        balance: b.balance,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
        doctorCutTotal: b.doctorCutTotal,
        clinicShareTotal: b.clinicShareTotal
      },
      create: {
        billId: b.billId,
        invoiceNumber: b.invoiceNumber,
        patientId: b.patientId,
        doctorId: b.doctorId,
        appointmentId: b.appointmentId || null,
        consultationType: b.consultationType,
        consultationFee: b.consultationFee,
        doctorCutConsultation: b.doctorCutConsultation,
        clinicShareConsultation: b.clinicShareConsultation,
        procedures: JSON.stringify(b.procedures || []),
        subtotal: b.subtotal,
        discount: b.discount,
        tax: b.tax,
        total: b.total,
        paid: b.paid,
        balance: b.balance,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
        doctorCutTotal: b.doctorCutTotal,
        clinicShareTotal: b.clinicShareTotal
      }
    });
  }
  console.log(`✔ ${billsSeed.length} Bills seeded`);

  console.log('✅ VIORA PRISMA DATABASE SEEDED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('Prisma seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

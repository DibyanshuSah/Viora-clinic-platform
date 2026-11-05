const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
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
  console.log('--- Checking VIORA Prisma Database for Initial Baseline ---');

  const isForce = process.argv.includes('--force');
  const existingUserCount = await prisma.user.count();
  const existingPatientCount = await prisma.patient.count();

  if (existingUserCount > 0 && !isForce) {
    console.log(`ℹ Found ${existingUserCount} existing user(s) and ${existingPatientCount} patient(s) in SQLite database.`);
    console.log('ℹ Non-destructive mode: Preserving all existing user accounts, client records, and transactions.');
  }

  // 1. Ensure Clinic Profile exists (upsert without overwriting existing custom settings)
  const existingProfile = await prisma.clinicProfile.findFirst();
  if (!existingProfile) {
    await prisma.clinicProfile.create({
      data: {
        id: 'viora-primary',
        ...clinicProfileSeed
      }
    });
    console.log('✔ Default Clinic Profile created');
  } else {
    console.log('✔ Clinic Profile already configured, preserving existing settings');
  }

  // 2. Ensure Default Users exist without resetting existing credentials
  for (const u of usersSeed) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { id: u.id },
          { username: u.username },
          { email: u.email }
        ]
      }
    });
    if (!existing) {
      await prisma.user.create({
        data: {
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
      console.log(`✔ User "${u.username}" (${u.role}) created`);
    } else {
      console.log(`✔ User matching "${u.username}", "${u.email}" or ID "${u.id}" exists (${existing.username}), preserving existing credentials`);
    }
  }

  // 3. Ensure Procedures catalog has baseline items if catalog is empty
  const procedureCount = await prisma.procedure.count();
  if (procedureCount === 0 || isForce) {
    for (const p of proceduresSeed) {
      const existing = await prisma.procedure.findUnique({ where: { procedureId: p.procedureId } });
      if (!existing) {
        await prisma.procedure.create({
          data: {
            procedureId: p.procedureId,
            name: p.name,
            defaultPrice: p.defaultPrice,
            defaultDoctorCut: p.defaultDoctorCut,
            description: p.description,
            status: p.status
          }
        });
      }
    }
    console.log(`✔ Baseline procedures catalog verified`);
  } else {
    console.log(`✔ Procedures catalog already populated (${procedureCount} procedures)`);
  }

  // 4. Ensure Doctors baseline if none exist
  const doctorCount = await prisma.doctor.count();
  if (doctorCount === 0 || isForce) {
    for (const doc of doctorsSeed) {
      const existing = await prisma.doctor.findFirst({
        where: {
          OR: [
            { doctorId: doc.doctorId },
            { email: doc.email },
            { registrationNumber: doc.registrationNumber }
          ]
        }
      });
      if (!existing) {
        // Ensure user account for doctor exists
        const doctorUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: doc.userId },
              { email: doc.email }
            ]
          }
        });
        if (!doctorUser) {
          await prisma.user.create({
            data: {
              id: doc.userId,
              username: 'doctor@viora',
              password: bcrypt.hashSync('doctor@123', 10),
              role: 'DOCTOR',
              name: doc.name,
              email: doc.email,
              phone: doc.phone,
              referenceId: doc.doctorId,
              status: 'Active'
            }
          });
        }
        await prisma.doctor.create({
          data: {
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
    }
    console.log(`✔ Baseline doctors verified`);
  } else {
    console.log(`✔ Doctor records already exist (${doctorCount} doctors)`);
  }

  // 5. Ensure Staff baseline if none exist
  const staffCount = await prisma.staff.count();
  if (staffCount === 0 || isForce) {
    for (const st of staffSeed) {
      const existing = await prisma.staff.findUnique({ where: { staffId: st.staffId } });
      if (!existing) {
        await prisma.staff.create({
          data: {
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
    }
    console.log(`✔ Baseline staff verified`);
  } else {
    console.log(`✔ Staff records already exist (${staffCount} staff)`);
  }

  // 6. Demo Patients, Appointments, Consultations, Prescriptions, Bills:
  // ONLY seeded if database has ZERO patients and ZERO bills and --force is explicitly provided.
  if (existingPatientCount === 0 && isForce) {
    console.log('ℹ Seeding initial demo clinical records (--force mode enabled on empty database)...');

    for (const pat of patientsSeed) {
      await prisma.patient.upsert({
        where: { patientId: pat.patientId },
        update: {},
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

    for (const apt of appointmentsSeed) {
      await prisma.appointment.upsert({
        where: { appointmentId: apt.appointmentId },
        update: {},
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

    for (const cns of consultationsSeed) {
      await prisma.consultation.upsert({
        where: { consultationId: cns.consultationId },
        update: {},
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

    for (const rx of prescriptionsSeed) {
      await prisma.prescription.upsert({
        where: { prescriptionId: rx.prescriptionId },
        update: {},
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

    for (const b of billsSeed) {
      await prisma.bill.upsert({
        where: { billId: b.billId },
        update: {},
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
    console.log('✔ Demo clinical records seeded');
  } else {
    console.log('✔ Clinical patient records protected (no demo data overwriting)');
  }

  console.log('✅ VIORA DATABASE INITIALIZATION CHECK COMPLETED SAFELY.');
}

main()
  .catch((e) => {
    console.error('Prisma seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

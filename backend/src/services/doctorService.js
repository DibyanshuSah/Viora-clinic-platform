const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const idGenerator = require('../utils/idGenerator');
const { safeParse, safeStringify } = require('../utils/jsonUtils');

class DoctorService {
  formatDoctor(doc, user = null) {
    const consultationRates = safeParse(doc.consultationRates, { consultationFee: 800, doctorCut: 500, clinicShare: 300 });
    const procedureRates = safeParse(doc.procedureRates, {});
    const workingDays = safeParse(doc.workingDays, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    const workingHours = safeParse(doc.workingHours, { start: "09:00", end: "17:00" });
    const breakTimes = safeParse(doc.breakTimes, { start: "13:00", end: "14:00" });

    const fee = consultationRates?.consultationFee ?? 800;
    const cut = consultationRates?.doctorCut ?? 500;
    const share = consultationRates?.clinicShare ?? (fee - cut);

    return {
      ...doc,
      consultationFee: fee,
      doctorCut: cut,
      clinicShare: share,
      consultationRates: {
        consultationFee: fee,
        doctorCut: cut,
        clinicShare: share
      },
      procedureRates,
      workingDays,
      workingHours,
      breakTimes,
      username: user ? user.username : null
    };
  }

  async getAllDoctors() {
    const doctors = await prisma.doctor.findMany({
      orderBy: { createdAt: 'asc' }
    });

    const userIds = doctors.map(d => d.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return doctors.map(doc => this.formatDoctor(doc, userMap.get(doc.userId)));
  }

  async getDoctorById(doctorId) {
    const doc = await prisma.doctor.findUnique({
      where: { doctorId }
    });
    if (!doc) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }

    const user = await prisma.user.findUnique({
      where: { id: doc.userId }
    });

    return this.formatDoctor(doc, user);
  }

  async createDoctor(data) {
    const {
      name,
      gender = 'Other',
      specialization,
      qualification = '',
      registrationNumber = '',
      phone,
      email,
      username,
      password,
      consultationFee = 800,
      doctorCut = 500,
      clinicShare = 300,
      workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      workingHours = { start: "09:00", end: "17:00" },
      breakTimes = { start: "13:00", end: "14:00" },
      procedureRates = {}
    } = data;

    if (!name || !specialization || !phone || !email || !username || !password) {
      throw { statusCode: 400, message: 'All required fields (Name, Specialization, Phone, Email, Username, Password) must be provided' };
    }

    const cleanUsername = username.trim();
    const existingUsers = await prisma.user.findMany();
    const isTaken = existingUsers.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (isTaken) {
      throw { statusCode: 400, message: 'Username is already taken' };
    }

    const doctorId = await idGenerator.nextDoctorId();
    const userId = idGenerator.nextUserId('doc');

    const fee = Number(consultationFee) || 0;
    const cut = Number(doctorCut) || 0;
    const share = Number(clinicShare) || (fee - cut);

    const consultationRatesObj = {
      consultationFee: fee,
      doctorCut: cut,
      clinicShare: share
    };

    // Execute atomic transaction for user and doctor creation
    const { newDoctor, newUser } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          id: userId,
          username: cleanUsername,
          password: bcrypt.hashSync(password, 10),
          role: 'DOCTOR',
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          referenceId: doctorId,
          status: 'Active'
        }
      });

      const createdDoctor = await tx.doctor.create({
        data: {
          doctorId,
          userId,
          name: name.trim(),
          gender,
          specialization: specialization.trim(),
          qualification: qualification ? qualification.trim() : '',
          registrationNumber: registrationNumber ? registrationNumber.trim() : '',
          phone: phone.trim(),
          email: email.trim(),
          consultationRates: safeStringify(consultationRatesObj),
          procedureRates: safeStringify(procedureRates || {}),
          workingDays: safeStringify(Array.isArray(workingDays) ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
          workingHours: safeStringify({
            start: workingHours.start || "09:00",
            end: workingHours.end || "17:00"
          }),
          breakTimes: safeStringify({
            start: breakTimes.start || "13:00",
            end: breakTimes.end || "14:00"
          }),
          status: 'Active'
        }
      });

      return { newDoctor: createdDoctor, newUser: createdUser };
    });

    return this.formatDoctor(newDoctor, newUser);
  }

  async updateDoctor(doctorId, data) {
    const doc = await prisma.doctor.findUnique({
      where: { doctorId }
    });
    if (!doc) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }

    const currentRates = safeParse(doc.consultationRates, { consultationFee: 800, doctorCut: 500, clinicShare: 300 });
    const currentHours = safeParse(doc.workingHours, { start: "09:00", end: "17:00" });
    const currentBreaks = safeParse(doc.breakTimes, { start: "13:00", end: "14:00" });

    const fee = Number(data.consultationFee !== undefined ? data.consultationFee : (currentRates.consultationFee ?? 800));
    const cut = Number(data.doctorCut !== undefined ? data.doctorCut : (currentRates.doctorCut ?? 500));
    const share = Number(data.clinicShare !== undefined ? data.clinicShare : (currentRates.clinicShare ?? (fee - cut)));

    const newRates = {
      consultationFee: fee,
      doctorCut: cut,
      clinicShare: share
    };

    const updateDocData = {
      consultationRates: safeStringify(newRates)
    };

    if (data.name !== undefined) updateDocData.name = data.name.trim();
    if (data.gender !== undefined) updateDocData.gender = data.gender;
    if (data.specialization !== undefined) updateDocData.specialization = data.specialization.trim();
    if (data.qualification !== undefined) updateDocData.qualification = data.qualification.trim();
    if (data.registrationNumber !== undefined) updateDocData.registrationNumber = data.registrationNumber.trim();
    if (data.phone !== undefined) updateDocData.phone = data.phone.trim();
    if (data.email !== undefined) updateDocData.email = data.email.trim();
    if (data.status !== undefined) updateDocData.status = data.status;
    if (data.procedureRates !== undefined) updateDocData.procedureRates = safeStringify(data.procedureRates);
    if (data.workingDays !== undefined) updateDocData.workingDays = safeStringify(data.workingDays);

    if (data.workingHours) {
      updateDocData.workingHours = safeStringify({
        start: data.workingHours.start || currentHours.start,
        end: data.workingHours.end || currentHours.end
      });
    }

    if (data.breakTimes) {
      updateDocData.breakTimes = safeStringify({
        start: data.breakTimes.start || currentBreaks.start,
        end: data.breakTimes.end || currentBreaks.end
      });
    }

    const updateUserPayload = {};
    if (data.name) updateUserPayload.name = data.name.trim();
    if (data.email) updateUserPayload.email = data.email.trim();
    if (data.phone) updateUserPayload.phone = data.phone.trim();
    if (data.status) updateUserPayload.status = data.status;
    if (data.password) {
      updateUserPayload.password = bcrypt.hashSync(data.password, 10);
    }

    const { updatedDoctor, updatedUser } = await prisma.$transaction(async (tx) => {
      const uDoc = await tx.doctor.update({
        where: { doctorId },
        data: updateDocData
      });

      let uUser = null;
      if (Object.keys(updateUserPayload).length > 0 && doc.userId) {
        uUser = await tx.user.update({
          where: { id: doc.userId },
          data: updateUserPayload
        });
      } else if (doc.userId) {
        uUser = await tx.user.findUnique({ where: { id: doc.userId } });
      }

      return { updatedDoctor: uDoc, updatedUser: uUser };
    });

    return this.formatDoctor(updatedDoctor, updatedUser);
  }

  async deleteDoctor(doctorId) {
    const doc = await prisma.doctor.findUnique({
      where: { doctorId }
    });
    if (!doc) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.doctor.update({
        where: { doctorId },
        data: { status: 'Inactive' }
      });

      if (doc.userId) {
        await tx.user.update({
          where: { id: doc.userId },
          data: { status: 'Inactive' }
        });
      }
    });

    return { message: 'Doctor deactivated successfully' };
  }
}

module.exports = new DoctorService();

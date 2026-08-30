const bcrypt = require('bcryptjs');
const db = require('../config/database');

class DoctorService {
  getAllDoctors() {
    return db.doctors.map(doc => {
      const user = db.users.find(u => u.id === doc.userId);
      return {
        ...doc,
        username: user ? user.username : null
      };
    });
  }

  getDoctorById(doctorId) {
    const doc = db.doctors.find(d => d.doctorId === doctorId);
    if (!doc) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }
    const user = db.users.find(u => u.id === doc.userId);
    return {
      ...doc,
      username: user ? user.username : null
    };
  }

  createDoctor(data) {
    const {
      name,
      gender = 'Other',
      specialization,
      qualification,
      registrationNumber,
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

    const existingUser = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (existingUser) {
      throw { statusCode: 400, message: 'Username is already taken' };
    }

    const doctorId = db.nextDoctorId();
    const userId = db.nextUserId('doc');

    const newUser = {
      id: userId,
      username: username.trim(),
      password: bcrypt.hashSync(password, 10),
      role: 'DOCTOR',
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      referenceId: doctorId,
      status: 'Active'
    };
    db.users.push(newUser);

    const newDoctor = {
      doctorId,
      userId,
      name: name.trim(),
      gender,
      specialization: specialization.trim(),
      qualification: qualification ? qualification.trim() : '',
      registrationNumber: registrationNumber ? registrationNumber.trim() : '',
      phone: phone.trim(),
      email: email.trim(),
      consultationRates: {
        consultationFee: Number(consultationFee) || 0,
        doctorCut: Number(doctorCut) || 0,
        clinicShare: Number(clinicShare) || (Number(consultationFee) - Number(doctorCut))
      },
      procedureRates: procedureRates || {},
      workingDays: Array.isArray(workingDays) ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      workingHours: {
        start: workingHours.start || "09:00",
        end: workingHours.end || "17:00"
      },
      breakTimes: {
        start: breakTimes.start || "13:00",
        end: breakTimes.end || "14:00"
      },
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    db.doctors.push(newDoctor);

    return {
      ...newDoctor,
      username: newUser.username
    };
  }

  updateDoctor(doctorId, data) {
    const index = db.doctors.findIndex(d => d.doctorId === doctorId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }

    const currentDoc = db.doctors[index];
    const userIndex = db.users.findIndex(u => u.id === currentDoc.userId);

    // Update doctor record
    db.doctors[index] = {
      ...currentDoc,
      ...data,
      doctorId: currentDoc.doctorId,
      userId: currentDoc.userId,
      consultationRates: {
        consultationFee: Number(data.consultationFee !== undefined ? data.consultationFee : currentDoc.consultationRates.consultationFee),
        doctorCut: Number(data.doctorCut !== undefined ? data.doctorCut : currentDoc.consultationRates.doctorCut),
        clinicShare: Number(data.clinicShare !== undefined ? data.clinicShare : currentDoc.consultationRates.clinicShare)
      },
      workingHours: data.workingHours ? {
        start: data.workingHours.start || currentDoc.workingHours.start,
        end: data.workingHours.end || currentDoc.workingHours.end
      } : currentDoc.workingHours,
      breakTimes: data.breakTimes ? {
        start: data.breakTimes.start || currentDoc.breakTimes.start,
        end: data.breakTimes.end || currentDoc.breakTimes.end
      } : currentDoc.breakTimes,
      updatedAt: new Date().toISOString()
    };

    // Update linked user details if relevant
    if (userIndex !== -1) {
      if (data.name) db.users[userIndex].name = data.name;
      if (data.email) db.users[userIndex].email = data.email;
      if (data.phone) db.users[userIndex].phone = data.phone;
      if (data.status) db.users[userIndex].status = data.status;
      if (data.password) {
        db.users[userIndex].password = bcrypt.hashSync(data.password, 10);
      }
    }

    const updatedUser = userIndex !== -1 ? db.users[userIndex] : null;

    return {
      ...db.doctors[index],
      username: updatedUser ? updatedUser.username : null
    };
  }

  deleteDoctor(doctorId) {
    const index = db.doctors.findIndex(d => d.doctorId === doctorId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }

    db.doctors[index].status = 'Inactive';
    const user = db.users.find(u => u.id === db.doctors[index].userId);
    if (user) {
      user.status = 'Inactive';
    }

    return { message: 'Doctor deactivated successfully' };
  }
}

module.exports = new DoctorService();

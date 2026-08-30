/**
 * Doctor Entity Model
 */
class Doctor {
  constructor({
    doctorId,
    userId,
    name,
    gender = 'Other',
    specialization,
    qualification = '',
    registrationNumber = '',
    phone,
    email,
    consultationRates = { consultationFee: 800, doctorCut: 500, clinicShare: 300 },
    procedureRates = {},
    workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    workingHours = { start: "09:00", end: "17:00" },
    breakTimes = { start: "13:00", end: "14:00" },
    status = 'Active',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.doctorId = doctorId;
    this.userId = userId;
    this.name = name;
    this.gender = gender;
    this.specialization = specialization;
    this.qualification = qualification;
    this.registrationNumber = registrationNumber;
    this.phone = phone;
    this.email = email;
    this.consultationRates = consultationRates; // { consultationFee, doctorCut, clinicShare }
    this.procedureRates = procedureRates; // { [procedureId]: { price, doctorCut, clinicShare } }
    this.workingDays = workingDays;
    this.workingHours = workingHours;
    this.breakTimes = breakTimes;
    this.status = status; // 'Active' | 'Inactive'
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Doctor;

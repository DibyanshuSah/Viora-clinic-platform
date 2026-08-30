/**
 * Doctor Schedule Entity Model
 */
class DoctorSchedule {
  constructor({
    doctorId,
    workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    workingHours = { start: "09:00", end: "17:00" },
    breakTimes = { start: "13:00", end: "14:00" },
    slotDurationMinutes = 20,
    status = 'Active'
  }) {
    this.doctorId = doctorId;
    this.workingDays = workingDays;
    this.workingHours = workingHours;
    this.breakTimes = breakTimes;
    this.slotDurationMinutes = slotDurationMinutes;
    this.status = status;
  }
}

module.exports = DoctorSchedule;

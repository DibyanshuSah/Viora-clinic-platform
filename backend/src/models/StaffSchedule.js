/**
 * Staff Schedule Entity Model
 */
class StaffSchedule {
  constructor({
    staffId,
    shift = 'Morning Shift',
    workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    startTime = "08:00",
    endTime = "14:00",
    scheduledHours = 6,
    workedHours = 6,
    attendance = "Present",
    status = "Active"
  }) {
    this.staffId = staffId;
    this.shift = shift;
    this.workingDays = workingDays;
    this.startTime = startTime;
    this.endTime = endTime;
    this.scheduledHours = Number(scheduledHours);
    this.workedHours = Number(workedHours);
    this.attendance = attendance;
    this.status = status;
  }
}

module.exports = StaffSchedule;

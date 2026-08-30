/**
 * Staff Entity Model
 */
class Staff {
  constructor({
    staffId,
    userId,
    name,
    phone,
    email,
    username,
    shift = 'Morning Shift',
    workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    startTime = "08:00",
    endTime = "14:00",
    scheduledHours = 6,
    workedHours = 6,
    attendance = "Present",
    status = "Active",
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.staffId = staffId;
    this.userId = userId;
    this.name = name;
    this.phone = phone;
    this.email = email;
    this.username = username;
    this.shift = shift;
    this.workingDays = workingDays;
    this.startTime = startTime;
    this.endTime = endTime;
    this.scheduledHours = Number(scheduledHours);
    this.workedHours = Number(workedHours);
    this.attendance = attendance;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Staff;

const bcrypt = require('bcryptjs');
const db = require('../config/database');

class StaffService {
  getAllStaff() {
    return db.staff.map(st => {
      const user = db.users.find(u => u.id === st.userId);
      return {
        ...st,
        username: user ? user.username : st.username
      };
    });
  }

  getStaffById(staffId) {
    const st = db.staff.find(s => s.staffId === staffId);
    if (!st) {
      throw { statusCode: 404, message: 'Staff member not found' };
    }
    const user = db.users.find(u => u.id === st.userId);
    return {
      ...st,
      username: user ? user.username : st.username
    };
  }

  createStaff(data) {
    const {
      name,
      phone,
      email,
      username,
      password,
      shift = 'Morning Shift',
      workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      startTime = "08:00",
      endTime = "14:00",
      scheduledHours = 6
    } = data;

    if (!name || !phone || !email || !username || !password) {
      throw { statusCode: 400, message: 'Name, Phone, Email, Username, and Password are required' };
    }

    const existingUser = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (existingUser) {
      throw { statusCode: 400, message: 'Username is already taken' };
    }

    const staffId = db.nextStaffId();
    const userId = db.nextUserId('staff');

    const newUser = {
      id: userId,
      username: username.trim(),
      password: bcrypt.hashSync(password, 10),
      role: 'STAFF',
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      referenceId: staffId,
      status: 'Active'
    };
    db.users.push(newUser);

    const newStaff = {
      staffId,
      userId,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      username: username.trim(),
      shift,
      workingDays: Array.isArray(workingDays) ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      startTime,
      endTime,
      scheduledHours: Number(scheduledHours) || 6,
      workedHours: Number(scheduledHours) || 6,
      attendance: "Present",
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    db.staff.push(newStaff);

    return newStaff;
  }

  updateStaff(staffId, data) {
    const index = db.staff.findIndex(s => s.staffId === staffId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Staff member not found' };
    }

    const currentStaff = db.staff[index];
    const userIndex = db.users.findIndex(u => u.id === currentStaff.userId);

    db.staff[index] = {
      ...currentStaff,
      ...data,
      staffId: currentStaff.staffId,
      userId: currentStaff.userId,
      updatedAt: new Date().toISOString()
    };

    if (userIndex !== -1) {
      if (data.name) db.users[userIndex].name = data.name;
      if (data.email) db.users[userIndex].email = data.email;
      if (data.phone) db.users[userIndex].phone = data.phone;
      if (data.status) db.users[userIndex].status = data.status;
      if (data.password) {
        db.users[userIndex].password = bcrypt.hashSync(data.password, 10);
      }
    }

    return db.staff[index];
  }

  deleteStaff(staffId) {
    const index = db.staff.findIndex(s => s.staffId === staffId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Staff member not found' };
    }

    db.staff[index].status = 'Inactive';
    const user = db.users.find(u => u.id === db.staff[index].userId);
    if (user) {
      user.status = 'Inactive';
    }

    return { message: 'Staff member deactivated successfully' };
  }
}

module.exports = new StaffService();

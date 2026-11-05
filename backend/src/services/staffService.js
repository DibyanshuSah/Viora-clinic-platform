const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const idGenerator = require('../utils/idGenerator');
const { safeParse, safeStringify } = require('../utils/jsonUtils');

class StaffService {
  formatStaff(st, user = null) {
    const workingDays = safeParse(st.workingDays, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    return {
      ...st,
      workingDays,
      username: user ? user.username : st.username
    };
  }

  async getAllStaff() {
    const staffMembers = await prisma.staff.findMany({
      orderBy: { createdAt: 'asc' }
    });

    const userIds = staffMembers.map(s => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return staffMembers.map(st => this.formatStaff(st, userMap.get(st.userId)));
  }

  async getStaffById(staffId) {
    const st = await prisma.staff.findUnique({
      where: { staffId }
    });
    if (!st) {
      throw { statusCode: 404, message: 'Staff member not found' };
    }

    const user = await prisma.user.findUnique({
      where: { id: st.userId }
    });

    return this.formatStaff(st, user);
  }

  async createStaff(data) {
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

    const cleanUsername = username.trim();
    const existingUsers = await prisma.user.findMany();
    const isTaken = existingUsers.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (isTaken) {
      throw { statusCode: 400, message: 'Username is already taken' };
    }

    const staffId = await idGenerator.nextStaffId();
    const userId = idGenerator.nextUserId('staff');

    const { newStaff, newUser } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          id: userId,
          username: cleanUsername,
          password: bcrypt.hashSync(password, 10),
          role: 'STAFF',
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          referenceId: staffId,
          status: 'Active'
        }
      });

      const createdStaff = await tx.staff.create({
        data: {
          staffId,
          userId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          username: cleanUsername,
          shift,
          workingDays: safeStringify(Array.isArray(workingDays) ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]),
          startTime,
          endTime,
          scheduledHours: Number(scheduledHours) || 6,
          workedHours: Number(scheduledHours) || 6,
          attendance: "Present",
          status: 'Active'
        }
      });

      return { newStaff: createdStaff, newUser: createdUser };
    });

    return this.formatStaff(newStaff, newUser);
  }

  async updateStaff(staffId, data) {
    const st = await prisma.staff.findUnique({
      where: { staffId }
    });
    if (!st) {
      throw { statusCode: 404, message: 'Staff member not found' };
    }

    const updateStaffData = {};
    if (data.name !== undefined) updateStaffData.name = data.name.trim();
    if (data.phone !== undefined) updateStaffData.phone = data.phone.trim();
    if (data.email !== undefined) updateStaffData.email = data.email.trim();
    if (data.shift !== undefined) updateStaffData.shift = data.shift;
    if (data.startTime !== undefined) updateStaffData.startTime = data.startTime;
    if (data.endTime !== undefined) updateStaffData.endTime = data.endTime;
    if (data.scheduledHours !== undefined) updateStaffData.scheduledHours = Number(data.scheduledHours) || 6;
    if (data.workedHours !== undefined) updateStaffData.workedHours = Number(data.workedHours) || 6;
    if (data.attendance !== undefined) updateStaffData.attendance = data.attendance;
    if (data.status !== undefined) updateStaffData.status = data.status;
    if (data.workingDays !== undefined) updateStaffData.workingDays = safeStringify(data.workingDays);

    const updateUserPayload = {};
    if (data.name) updateUserPayload.name = data.name.trim();
    if (data.email) updateUserPayload.email = data.email.trim();
    if (data.phone) updateUserPayload.phone = data.phone.trim();
    if (data.status) updateUserPayload.status = data.status;
    if (data.password) {
      updateUserPayload.password = bcrypt.hashSync(data.password, 10);
    }

    const { updatedStaff, updatedUser } = await prisma.$transaction(async (tx) => {
      const uStaff = await tx.staff.update({
        where: { staffId },
        data: updateStaffData
      });

      let uUser = null;
      if (Object.keys(updateUserPayload).length > 0 && st.userId) {
        uUser = await tx.user.update({
          where: { id: st.userId },
          data: updateUserPayload
        });
      } else if (st.userId) {
        uUser = await tx.user.findUnique({ where: { id: st.userId } });
      }

      return { updatedStaff: uStaff, updatedUser: uUser };
    });

    return this.formatStaff(updatedStaff, updatedUser);
  }

  async deleteStaff(staffId) {
    const st = await prisma.staff.findUnique({
      where: { staffId }
    });
    if (!st) {
      throw { statusCode: 404, message: 'Staff member not found' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { staffId },
        data: { status: 'Inactive' }
      });

      if (st.userId) {
        await tx.user.update({
          where: { id: st.userId },
          data: { status: 'Inactive' }
        });
      }
    });

    return { message: 'Staff member deactivated successfully' };
  }
}

module.exports = new StaffService();

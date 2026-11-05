const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { jwtSecret, jwtExpiresIn } = require('../config/environment');

class AuthService {
  async login(username, password) {
    const cleanUsername = (username || '').trim();
    // Case-insensitive user lookup
    const users = await prisma.user.findMany({
      where: { status: 'Active' }
    });

    const user = users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());

    if (!user) {
      throw { statusCode: 401, message: 'Invalid username or password' };
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid username or password' };
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      referenceId: user.referenceId || null
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });

    let profileDetails = null;
    if (user.role === 'DOCTOR' && user.referenceId) {
      profileDetails = await prisma.doctor.findUnique({
        where: { doctorId: user.referenceId }
      });
    } else if (user.role === 'STAFF' && user.referenceId) {
      profileDetails = await prisma.staff.findUnique({
        where: { staffId: user.referenceId }
      });
    }

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        referenceId: user.referenceId || null,
        profileDetails
      }
    };
  }

  async switchDemoRole(targetRole) {
    const roleNormalized = (targetRole || '').toUpperCase();
    const user = await prisma.user.findFirst({
      where: { role: roleNormalized, status: 'Active' }
    });

    if (!user) {
      if (roleNormalized === 'DOCTOR') {
        throw { statusCode: 404, message: 'No doctor accounts registered yet. Please add a doctor in Admin > Doctor Management first.' };
      }
      if (roleNormalized === 'STAFF') {
        throw { statusCode: 404, message: 'No active staff accounts registered. Please add a staff member in Admin > Staff Management first.' };
      }
      throw { statusCode: 404, message: `No demo account found for role ${targetRole}` };
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      referenceId: user.referenceId || null
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });

    let profileDetails = null;
    if (user.role === 'DOCTOR' && user.referenceId) {
      profileDetails = await prisma.doctor.findUnique({
        where: { doctorId: user.referenceId }
      });
    } else if (user.role === 'STAFF' && user.referenceId) {
      profileDetails = await prisma.staff.findUnique({
        where: { staffId: user.referenceId }
      });
    }

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        referenceId: user.referenceId || null,
        profileDetails
      }
    };
  }

  async getMe(userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, status: 'Active' }
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    let profileDetails = null;
    if (user.role === 'DOCTOR' && user.referenceId) {
      profileDetails = await prisma.doctor.findUnique({
        where: { doctorId: user.referenceId }
      });
    } else if (user.role === 'STAFF' && user.referenceId) {
      profileDetails = await prisma.staff.findUnique({
        where: { staffId: user.referenceId }
      });
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
      referenceId: user.referenceId || null,
      profileDetails
    };
  }
}

module.exports = new AuthService();

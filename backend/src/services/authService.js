const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { jwtSecret, jwtExpiresIn } = require('../config/environment');

class AuthService {
  async login(username, password) {
    const user = db.users.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.status === 'Active'
    );

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
      profileDetails = db.doctors.find(d => d.doctorId === user.referenceId);
    } else if (user.role === 'STAFF' && user.referenceId) {
      profileDetails = db.staff.find(s => s.staffId === user.referenceId);
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
    let user;
    if (targetRole === 'ADMIN') {
      user = db.users.find(u => u.role === 'ADMIN');
    } else if (targetRole === 'DOCTOR') {
      user = db.users.find(u => u.role === 'DOCTOR');
    } else if (targetRole === 'STAFF') {
      user = db.users.find(u => u.role === 'STAFF');
    }

    if (!user) {
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
      profileDetails = db.doctors.find(d => d.doctorId === user.referenceId);
    } else if (user.role === 'STAFF' && user.referenceId) {
      profileDetails = db.staff.find(s => s.staffId === user.referenceId);
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
    const user = db.users.find(u => u.id === userId && u.status === 'Active');
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    let profileDetails = null;
    if (user.role === 'DOCTOR' && user.referenceId) {
      profileDetails = db.doctors.find(d => d.doctorId === user.referenceId);
    } else if (user.role === 'STAFF' && user.referenceId) {
      profileDetails = db.staff.find(s => s.staffId === user.referenceId);
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

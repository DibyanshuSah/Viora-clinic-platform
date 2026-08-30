const db = require('../config/database');

class ClinicService {
  getProfile() {
    return db.clinicProfile;
  }

  updateProfile(updateData) {
    db.clinicProfile = {
      ...db.clinicProfile,
      ...updateData,
      clinicName: "VIORA", // Always enforce VIORA branding
      updatedAt: new Date().toISOString()
    };
    return db.clinicProfile;
  }
}

module.exports = new ClinicService();

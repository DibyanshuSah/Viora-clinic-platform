const prisma = require('../config/prisma');

class ClinicService {
  async getProfile() {
    let profile = await prisma.clinicProfile.findFirst({
      where: { id: 'viora-primary' }
    });

    if (!profile) {
      profile = await prisma.clinicProfile.findFirst();
    }

    if (!profile) {
      profile = await prisma.clinicProfile.create({
        data: {
          id: 'viora-primary',
          clinicName: 'VIORA',
          address: '42, Health Crest Boulevard, Medical Enclave, 4th Block, Koramangala',
          city: 'Bengaluru',
          state: 'Karnataka',
          pinCode: '560034',
          contactNumber: '+91 80 4920 8800',
          email: 'contact@vioraclinic.com',
          website: 'https://vioracare.in'
        }
      });
    }

    return profile;
  }

  async updateProfile(updateData) {
    const { id: _ignoredId, createdAt: _ignoredCreated, ...cleanData } = updateData;

    const profile = await prisma.clinicProfile.upsert({
      where: { id: 'viora-primary' },
      update: {
        ...cleanData,
        clinicName: 'VIORA' // Always enforce VIORA branding
      },
      create: {
        id: 'viora-primary',
        ...cleanData,
        clinicName: 'VIORA'
      }
    });

    return profile;
  }
}

module.exports = new ClinicService();

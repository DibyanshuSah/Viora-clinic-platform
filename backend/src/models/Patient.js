/**
 * Patient Entity Model
 */
class Patient {
  constructor({
    patientId,
    name,
    dateOfBirth = null,
    age,
    gender = 'Other',
    phone,
    email = null,
    address = null,
    city = 'Bengaluru',
    state = 'Karnataka',
    pinCode = null,
    allergies = 'None',
    medicalHistory = 'None',
    emergencyContact = null,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.patientId = patientId;
    this.name = name;
    this.dateOfBirth = dateOfBirth;
    this.age = Number(age);
    this.gender = gender;
    this.phone = phone;
    this.email = email;
    this.address = address;
    this.city = city;
    this.state = state;
    this.pinCode = pinCode;
    this.allergies = allergies;
    this.medicalHistory = medicalHistory;
    this.emergencyContact = emergencyContact;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Patient;

/**
 * User Entity Model
 * Roles: ADMIN | DOCTOR | STAFF
 */
class User {
  constructor({
    id,
    username,
    password,
    role,
    name,
    email,
    phone,
    referenceId = null,
    status = 'Active',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.id = id;
    this.username = username;
    this.password = password;
    this.role = role; // 'ADMIN' | 'DOCTOR' | 'STAFF'
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.referenceId = referenceId; // links to Doctor.doctorId or Staff.staffId
    this.status = status; // 'Active' | 'Inactive'
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  toJSON() {
    // Never expose password hash in JSON serialization
    const { password, ...safeUser } = this;
    return safeUser;
  }
}

module.exports = User;

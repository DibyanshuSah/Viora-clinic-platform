/**
 * Procedure Entity Model
 */
class Procedure {
  constructor({
    procedureId,
    name,
    defaultPrice,
    defaultDoctorCut = 0,
    description = '',
    status = 'Active',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.procedureId = procedureId;
    this.name = name;
    this.defaultPrice = Number(defaultPrice);
    this.defaultDoctorCut = Number(defaultDoctorCut);
    this.description = description;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Procedure;

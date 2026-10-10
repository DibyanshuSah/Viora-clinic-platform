const db = require('../config/database');

class ProcedureService {
  getAllProcedures() {
    return db.procedures;
  }

  getProcedureById(procedureId) {
    const proc = db.procedures.find(p => p.procedureId === procedureId);
    if (!proc) {
      throw { statusCode: 404, message: 'Procedure not found' };
    }
    return proc;
  }

  createProcedure(data) {
    const { name, defaultPrice, defaultDoctorCut, description = '', status = 'Active' } = data;
    if (!name || defaultPrice === undefined) {
      throw { statusCode: 400, message: 'Procedure Name and Default Price are required' };
    }

    const trimmedName = name.trim();
    // Check if procedure already exists by name (case-insensitive)
    const existing = db.procedures.find(p => p.name && p.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      existing.defaultPrice = Number(defaultPrice);
      if (defaultDoctorCut !== undefined) existing.defaultDoctorCut = Number(defaultDoctorCut);
      if (description) existing.description = description.trim();
      existing.status = 'Active';
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    const procedureId = db.nextProcedureId();
    const newProcedure = {
      procedureId,
      name: trimmedName,
      defaultPrice: Number(defaultPrice),
      defaultDoctorCut: defaultDoctorCut !== undefined ? Number(defaultDoctorCut) : Math.round(Number(defaultPrice) * 0.3),
      description: description ? description.trim() : '',
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.procedures.push(newProcedure);
    return newProcedure;
  }

  updateProcedure(procedureId, data) {
    const index = db.procedures.findIndex(p => p.procedureId === procedureId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Procedure not found' };
    }

    db.procedures[index] = {
      ...db.procedures[index],
      ...data,
      procedureId: db.procedures[index].procedureId,
      defaultPrice: data.defaultPrice !== undefined ? Number(data.defaultPrice) : db.procedures[index].defaultPrice,
      defaultDoctorCut: data.defaultDoctorCut !== undefined ? Number(data.defaultDoctorCut) : db.procedures[index].defaultDoctorCut
    };

    return db.procedures[index];
  }

  deleteProcedure(procedureId) {
    const index = db.procedures.findIndex(p => p.procedureId === procedureId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Procedure not found' };
    }

    db.procedures[index].status = 'Inactive';
    return { message: 'Procedure deactivated successfully' };
  }
}

module.exports = new ProcedureService();

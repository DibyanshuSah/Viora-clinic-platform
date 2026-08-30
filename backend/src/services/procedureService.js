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
    const { name, defaultPrice, defaultDoctorCut = 0, description = '', status = 'Active' } = data;
    if (!name || defaultPrice === undefined) {
      throw { statusCode: 400, message: 'Procedure Name and Default Price are required' };
    }

    const procedureId = db.nextProcedureId();
    const newProcedure = {
      procedureId,
      name: name.trim(),
      defaultPrice: Number(defaultPrice),
      defaultDoctorCut: Number(defaultDoctorCut),
      description: description.trim(),
      status
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

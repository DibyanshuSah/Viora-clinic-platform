const prisma = require('../config/prisma');
const idGenerator = require('../utils/idGenerator');

class ProcedureService {
  async getAllProcedures() {
    return await prisma.procedure.findMany({
      orderBy: { createdAt: 'asc' }
    });
  }

  async getProcedureById(procedureId) {
    const proc = await prisma.procedure.findUnique({
      where: { procedureId }
    });
    if (!proc) {
      throw { statusCode: 404, message: 'Procedure not found' };
    }
    return proc;
  }

  async createProcedure(data) {
    const { name, defaultPrice, defaultDoctorCut, description = '', status = 'Active' } = data;
    if (!name || defaultPrice === undefined) {
      throw { statusCode: 400, message: 'Procedure Name and Default Price are required' };
    }

    const trimmedName = name.trim();
    // Check if procedure already exists by name
    const existing = await prisma.procedure.findFirst({
      where: { name: trimmedName }
    });

    if (existing) {
      return await prisma.procedure.update({
        where: { procedureId: existing.procedureId },
        data: {
          defaultPrice: Number(defaultPrice),
          defaultDoctorCut: defaultDoctorCut !== undefined ? Number(defaultDoctorCut) : existing.defaultDoctorCut,
          description: description ? description.trim() : existing.description,
          status: 'Active'
        }
      });
    }

    const procedureId = await idGenerator.nextProcedureId();
    const priceNum = Number(defaultPrice);
    const doctorCutNum = defaultDoctorCut !== undefined ? Number(defaultDoctorCut) : Math.round(priceNum * 0.3);

    return await prisma.procedure.create({
      data: {
        procedureId,
        name: trimmedName,
        defaultPrice: priceNum,
        defaultDoctorCut: doctorCutNum,
        description: description ? description.trim() : '',
        status
      }
    });
  }

  async updateProcedure(procedureId, data) {
    const proc = await prisma.procedure.findUnique({
      where: { procedureId }
    });
    if (!proc) {
      throw { statusCode: 404, message: 'Procedure not found' };
    }

    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.defaultPrice !== undefined) updatePayload.defaultPrice = Number(data.defaultPrice);
    if (data.defaultDoctorCut !== undefined) updatePayload.defaultDoctorCut = Number(data.defaultDoctorCut);
    if (data.description !== undefined) updatePayload.description = data.description.trim();
    if (data.status !== undefined) updatePayload.status = data.status;

    return await prisma.procedure.update({
      where: { procedureId },
      data: updatePayload
    });
  }

  async deleteProcedure(procedureId) {
    const proc = await prisma.procedure.findUnique({
      where: { procedureId }
    });
    if (!proc) {
      throw { statusCode: 404, message: 'Procedure not found' };
    }

    await prisma.procedure.update({
      where: { procedureId },
      data: { status: 'Inactive' }
    });

    return { message: 'Procedure deactivated successfully' };
  }
}

module.exports = new ProcedureService();

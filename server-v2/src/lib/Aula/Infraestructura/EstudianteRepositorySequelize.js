const Estudiante = require("../Dominio/Entidades/Estudiante");
const EstudianteModel = require("./EstudianteModel");
const CursoModel = require("./CursoModel");
const { InteresEstudianteModel } = EstudianteModel;
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const { obtenerSequelize } = require("../../../Infraestructura/database/Sequelize");

const esUuid = (valor) => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
const esDuplicado = (error) => Boolean(error) && error.name === "SequelizeUniqueConstraintError";

const plano = (fila) => fila.get({ plain: true });
const CAMPOS_EDITABLES = ["codigoLista", "apodo", "franjaEdad", "avatarId", "archivado"];

// Los estudiantes no guardan docente: su dueño es el del curso (3FN). Toda consulta por docente lo comprueba aquí.
const conIntereses = { model: InteresEstudianteModel, as: "intereses" };
const delDocente = (docenteId) => ({ model: CursoModel, as: "curso", attributes: [], required: true, where: { docenteId } });

async function reemplazarIntereses(estudianteId, intereses, transaction) {
  await InteresEstudianteModel.destroy({ where: { estudianteId }, transaction });
  if (intereses.length) {
    const unicos = [...new Set(intereses)];
    await InteresEstudianteModel.bulkCreate(unicos.map((tematica) => ({ estudianteId, tematica })), { transaction });
  }
}

class EstudianteRepositorySequelize {
  async save(estudiante) {
    try {
      const id = await obtenerSequelize().transaction(async (transaction) => {
        const fila = await EstudianteModel.create(
          {
            cursoId: estudiante.cursoId,
            codigoLista: estudiante.codigoLista,
            apodo: estudiante.apodo,
            franjaEdad: estudiante.franjaEdad,
            avatarId: estudiante.avatarId,
            archivado: estudiante.archivado
          },
          { transaction }
        );
        await reemplazarIntereses(fila.id, estudiante.intereses, transaction);
        return fila.id;
      });
      return this.aEntidad(plano(await EstudianteModel.findByPk(id, { include: [conIntereses] })));
    } catch (error) {
      throw this.traducirDuplicado(error);
    }
  }

  async findById(id, docenteId) {
    if (!esUuid(id) || !esUuid(docenteId)) return null;
    const fila = await EstudianteModel.findOne({ where: { id }, include: [conIntereses, delDocente(docenteId)] });
    return fila ? this.aEntidad(plano(fila)) : null;
  }

  async findByCurso(cursoId, docenteId, { archivado } = {}) {
    if (!esUuid(cursoId) || !esUuid(docenteId)) return [];
    const where = { cursoId };
    if (typeof archivado === "boolean") where.archivado = archivado;
    const filas = await EstudianteModel.findAll({
      where,
      include: [conIntereses, delDocente(docenteId)],
      order: [["codigoLista", "ASC"]]
    });
    return filas.map((fila) => this.aEntidad(plano(fila)));
  }

  async update(id, docenteId, cambios) {
    if (!esUuid(id) || !esUuid(docenteId)) return null;
    const valores = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (cambios && cambios[campo] !== undefined) valores[campo] = cambios[campo];
    }
    try {
      await obtenerSequelize().transaction(async (transaction) => {
        const fila = await EstudianteModel.findOne({
          where: { id },
          include: [delDocente(docenteId)],
          transaction,
          // Se bloquea solo la fila del estudiante (no la del curso unido)
          lock: { level: transaction.LOCK.UPDATE, of: EstudianteModel }
        });
        if (!fila) return;
        if (Object.keys(valores).length) await fila.update(valores, { transaction });
        if (cambios && Array.isArray(cambios.intereses)) await reemplazarIntereses(id, cambios.intereses, transaction);
      });
    } catch (error) {
      throw this.traducirDuplicado(error);
    }
    return this.findById(id, docenteId);
  }

  async contarActivosPorCurso(cursoId, docenteId) {
    if (!esUuid(cursoId) || !esUuid(docenteId)) return 0;
    return EstudianteModel.count({ where: { cursoId, archivado: false }, include: [delDocente(docenteId)] });
  }

  traducirDuplicado(error) {
    return esDuplicado(error)
      ? new ConflictoDeEstado("Ese código de lista ya existe en el curso", "CODIGO_LISTA_DUPLICADO")
      : error;
  }

  aEntidad(fila) {
    return new Estudiante({
      id: fila.id,
      cursoId: fila.cursoId,
      codigoLista: fila.codigoLista,
      apodo: fila.apodo || undefined,
      franjaEdad: fila.franjaEdad,
      avatarId: fila.avatarId,
      intereses: (fila.intereses || []).map((interes) => interes.tematica).sort(),
      archivado: fila.archivado,
      creadoEn: fila.creadoEn,
      actualizadoEn: fila.actualizadoEn
    });
  }
}

module.exports = EstudianteRepositorySequelize;

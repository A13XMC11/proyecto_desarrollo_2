const Curso = require("../Dominio/Entidades/Curso");
const CursoModel = require("./CursoModel");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

const esUuid = (valor) => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
const esDuplicado = (error) => Boolean(error) && error.name === "SequelizeUniqueConstraintError";

const plano = (fila) => fila.get({ plain: true });
const CAMPOS_EDITABLES = ["grado", "paralelo", "anioLectivo", "archivado"];

class CursoRepositorySequelize {
  async save(curso) {
    try {
      const fila = await CursoModel.create({
        docenteId: curso.docenteId,
        grado: curso.grado,
        paralelo: curso.paralelo,
        anioLectivo: curso.anioLectivo,
        archivado: curso.archivado
      });
      return this.aEntidad(plano(fila));
    } catch (error) {
      throw this.traducirDuplicado(error);
    }
  }

  async findById(id, docenteId) {
    if (!esUuid(id) || !esUuid(docenteId)) return null;
    const fila = await CursoModel.findOne({ where: { id, docenteId } });
    return fila ? this.aEntidad(plano(fila)) : null;
  }

  // filtros.archivado: true | false | undefined (todos)
  async findAllByDocente(docenteId, { archivado } = {}) {
    if (!esUuid(docenteId)) return [];
    const where = { docenteId };
    if (typeof archivado === "boolean") where.archivado = archivado;
    const filas = await CursoModel.findAll({
      where,
      order: [["anioLectivo", "DESC"], ["grado", "ASC"], ["paralelo", "ASC"]]
    });
    return filas.map((fila) => this.aEntidad(plano(fila)));
  }

  async update(id, docenteId, cambios) {
    if (!esUuid(id) || !esUuid(docenteId)) return null;
    const valores = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (cambios && cambios[campo] !== undefined) valores[campo] = cambios[campo];
    }
    if (!Object.keys(valores).length) return this.findById(id, docenteId);
    try {
      const [, filas] = await CursoModel.update(valores, { where: { id, docenteId }, returning: true });
      return filas.length ? this.aEntidad(plano(filas[0])) : null;
    } catch (error) {
      throw this.traducirDuplicado(error);
    }
  }

  async contarActivos(docenteId) {
    if (!esUuid(docenteId)) return 0;
    return CursoModel.count({ where: { docenteId, archivado: false } });
  }

  traducirDuplicado(error) {
    return esDuplicado(error)
      ? new ConflictoDeEstado("Ya existe un curso con ese grado, paralelo y año lectivo", "CURSO_DUPLICADO")
      : error;
  }

  aEntidad(fila) {
    return new Curso({
      id: fila.id,
      docenteId: fila.docenteId,
      grado: fila.grado,
      paralelo: fila.paralelo,
      anioLectivo: fila.anioLectivo,
      archivado: fila.archivado,
      creadoEn: fila.creadoEn,
      actualizadoEn: fila.actualizadoEn
    });
  }
}

module.exports = CursoRepositorySequelize;

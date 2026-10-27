const Docente = require("../Dominio/Entidades/Docente");
const DocenteModel = require("./DocenteModel");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

const esUuid = (valor) => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
const esDuplicado = (error) => Boolean(error) && error.name === "SequelizeUniqueConstraintError";

const plano = (fila) => fila.get({ plain: true });

class DocenteRepositorySequelize {
  async save(docente) {
    try {
      const fila = await DocenteModel.create({
        nombre: docente.nombre,
        correo: docente.correo,
        hash: docente.hash,
        institucion: docente.institucion
      });
      // El hash no se devuelve al guardar
      return this.aEntidad({ ...plano(fila), hash: undefined });
    } catch (error) {
      if (esDuplicado(error)) {
        throw new ConflictoDeEstado("El correo ya está registrado", "CORREO_YA_REGISTRADO");
      }
      throw error;
    }
  }

  // Sin hash (el alcance por defecto del modelo lo excluye)
  async findById(id) {
    if (!esUuid(id)) return null;
    const fila = await DocenteModel.findByPk(id);
    return fila ? this.aEntidad(plano(fila)) : null;
  }

  async findAll() {
    const filas = await DocenteModel.findAll({ order: [["nombre", "ASC"], ["id", "ASC"]] });
    return filas.map((fila) => this.aEntidad(plano(fila)));
  }

  // Con hash: solo para iniciar sesión
  async findByCorreo(correo) {
    if (typeof correo !== "string") return null;
    const fila = await DocenteModel.scope("conHash").findOne({ where: { correo: correo.trim().toLowerCase() } });
    return fila ? this.aEntidad(plano(fila)) : null;
  }

  // Solo nombre e institucion; null limpia el campo
  async update(id, cambios) {
    if (!esUuid(id)) return null;
    const valores = {};
    for (const campo of ["nombre", "institucion"]) {
      if (cambios && cambios[campo] !== undefined) valores[campo] = cambios[campo];
    }
    if (!Object.keys(valores).length) return this.findById(id);
    const [, filas] = await DocenteModel.update(valores, { where: { id }, returning: true });
    return filas.length ? this.aEntidad({ ...plano(filas[0]), hash: undefined }) : null;
  }

  // Borrado físico: la base lo rechaza si el docente tiene cursos, generaciones o cuotas (RESTRICT).
  // Devuelve true si existía.
  async eliminar(id) {
    if (!esUuid(id)) return false;
    try {
      return (await DocenteModel.destroy({ where: { id } })) > 0;
    } catch (error) {
      // RESTRICT en PostgreSQL llega como 23001 (restrict_violation) dentro de un SequelizeDatabaseError
      const porRestriccion = error.name === "SequelizeForeignKeyConstraintError" ||
        ["23001", "23503"].includes(error.parent && error.parent.code);
      if (porRestriccion) {
        throw new ConflictoDeEstado("El docente tiene cursos o datos asociados", "DOCENTE_CON_DATOS");
      }
      throw error;
    }
  }

  aEntidad(fila) {
    return new Docente({
      id: fila.id,
      nombre: fila.nombre,
      correo: fila.correo,
      hash: fila.hash,
      institucion: fila.institucion || undefined,
      creadoEn: fila.creadoEn,
      actualizadoEn: fila.actualizadoEn
    });
  }
}

module.exports = DocenteRepositorySequelize;

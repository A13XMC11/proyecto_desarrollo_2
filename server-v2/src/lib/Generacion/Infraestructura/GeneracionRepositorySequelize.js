const { Op } = require("sequelize");
const Generacion = require("../Dominio/Entidades/Generacion");
const GeneracionModel = require("./GeneracionModel");
const { ReservaModel } = GeneracionModel;
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const { ESTADOS_GENERACION_ACTIVOS } = require("../../Compartido/Dominio/ValoresPermitidos");
const { obtenerSequelize } = require("../../../Infraestructura/database/Sequelize");

const esUuid = (valor) => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
const esObjectId = (valor) => typeof valor === "string" && /^[0-9a-f]{24}$/i.test(valor);
const esDuplicado = (error) => Boolean(error) && error.name === "SequelizeUniqueConstraintError";

const plano = (fila) => fila.get({ plain: true });
const conReserva = { model: ReservaModel, as: "reserva" };
const CAMPOS_USO = ["proveedor", "modelo", "tokensEntrada", "tokensSalida", "usoDesconocido"];
const LIMITE_VENCIDAS = 100;
const LIMITE_LISTA = 50;

const soloUso = (uso) => {
  const valores = {};
  for (const campo of CAMPOS_USO) {
    if (uso && uso[campo] !== undefined) valores[campo] = uso[campo];
  }
  return valores;
};

class GeneracionRepositorySequelize {
  // Idempotente por (docenteId, claveSolicitud): ante clave duplicada devuelve la existente.
  // Devuelve { generacion, esNueva }.
  async save(generacion) {
    const p = generacion.parametros;
    try {
      const fila = await GeneracionModel.create({
        docenteId: generacion.docenteId,
        canalId: generacion.canalId,
        claveSolicitud: generacion.claveSolicitud,
        cursoId: p.cursoId,
        estudianteId: p.estudianteId,
        habilidad: p.habilidad,
        tematica: p.tematica,
        cantidad: p.cantidad,
        instruccion: p.instruccion,
        estado: generacion.estado
      });
      return { generacion: await this.recargar(fila.id), esNueva: true };
    } catch (error) {
      if (!esDuplicado(error)) throw error;
      const existente = await GeneracionModel.findOne({
        where: { docenteId: generacion.docenteId, claveSolicitud: generacion.claveSolicitud },
        include: [conReserva]
      });
      if (!existente) throw error;
      return { generacion: this.aEntidad(plano(existente)), esNueva: false };
    }
  }

  async findById(id, docenteId) {
    if (!esUuid(id) || !esUuid(docenteId)) return null;
    const fila = await GeneracionModel.findOne({ where: { id, docenteId }, include: [conReserva] });
    return fila ? this.aEntidad(plano(fila)) : null;
  }

  // Más recientes primero; filtros.estado opcional
  async findByDocente(docenteId, { estado } = {}) {
    if (!esUuid(docenteId)) return [];
    const where = { docenteId };
    if (typeof estado === "string") where.estado = estado;
    const filas = await GeneracionModel.findAll({
      where,
      include: [conReserva],
      order: [["creadaEn", "DESC"], ["id", "ASC"]],
      limit: LIMITE_LISTA
    });
    return filas.map((fila) => this.aEntidad(plano(fila)));
  }

  async findByClave(docenteId, claveSolicitud) {
    if (!esUuid(docenteId) || typeof claveSolicitud !== "string") return null;
    const fila = await GeneracionModel.findOne({ where: { docenteId, claveSolicitud }, include: [conReserva] });
    return fila ? this.aEntidad(plano(fila)) : null;
  }

  // Guarda la reserva hecha en los contadores (solo si la generación sigue activa).
  async registrarReserva(id, docenteId, reserva) {
    if (!esUuid(id) || !esUuid(docenteId) || !reserva) return null;
    const registrada = await obtenerSequelize().transaction(async (transaction) => {
      const activa = await GeneracionModel.findOne({
        where: { id, docenteId, estado: { [Op.in]: ESTADOS_GENERACION_ACTIVOS } },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!activa) return false;
      await ReservaModel.upsert(
        {
          generacionId: id,
          cuotaDiariaId: reserva.cuotaDiariaId,
          cupoDiario: reserva.cupoDiario,
          cuotaGlobalId: reserva.cuotaGlobalId,
          montoGlobal: reserva.montoGlobal,
          liberada: false
        },
        { transaction }
      );
      return true;
    });
    return registrada ? this.recargar(id) : null;
  }

  // Devuelve la generación solo la primera vez (null si ya estaba liberada o no hay reserva):
  // garantiza una sola liberación.
  async marcarReservaLiberada(id, docenteId) {
    if (!esUuid(id) || !esUuid(docenteId)) return null;
    if (!(await GeneracionModel.findOne({ where: { id, docenteId } }))) return null;
    const [, filas] = await ReservaModel.update({ liberada: true }, { where: { generacionId: id, liberada: false }, returning: true });
    return filas.length ? this.recargar(id) : null;
  }

  async marcarProcesando(id, docenteId) {
    return this.transicion(id, docenteId, ["pendiente"], { estado: "procesando" });
  }

  // También desde "interrumpida": la conciliación completa generaciones que ya tienen juego.
  async marcarCompletada(id, docenteId, juegoId, uso = {}) {
    if (!esObjectId(juegoId)) return null;
    return this.transicion(id, docenteId, [...ESTADOS_GENERACION_ACTIVOS, "interrumpida"], {
      ...soloUso(uso),
      estado: "completada",
      juegoId,
      finalizadaEn: new Date(),
      errorCodigo: null
    });
  }

  async marcarFallida(id, docenteId, errorCodigo, uso = {}) {
    return this.transicion(id, docenteId, ESTADOS_GENERACION_ACTIVOS, {
      ...soloUso(uso),
      estado: "fallida",
      errorCodigo,
      finalizadaEn: new Date()
    });
  }

  async marcarInterrumpida(id, docenteId, uso = {}) {
    return this.transicion(id, docenteId, ESTADOS_GENERACION_ACTIVOS, {
      usoDesconocido: true,
      ...soloUso(uso),
      estado: "interrumpida",
      finalizadaEn: new Date()
    });
  }

  async contarActivas(docenteId) {
    if (!esUuid(docenteId)) return 0;
    return GeneracionModel.count({ where: { docenteId, estado: { [Op.in]: ESTADOS_GENERACION_ACTIVOS } } });
  }

  // Activas creadas antes de la fecha dada (de cualquier docente, para la conciliación).
  async findVencidas(antesDe) {
    const limite = antesDe instanceof Date ? antesDe : new Date(antesDe);
    if (Number.isNaN(limite.getTime())) return [];
    const filas = await GeneracionModel.findAll({
      where: { estado: { [Op.in]: ESTADOS_GENERACION_ACTIVOS }, creadaEn: { [Op.lt]: limite } },
      include: [conReserva],
      order: [["creadaEn", "ASC"], ["id", "ASC"]],
      limit: LIMITE_VENCIDAS
    });
    return filas.map((fila) => this.aEntidad(plano(fila)));
  }

  // Transición condicional al estado de origen: nunca pisa un estado final.
  async transicion(id, docenteId, desde, valores) {
    if (!esUuid(id) || !esUuid(docenteId)) return null;
    try {
      const [, filas] = await GeneracionModel.update(valores, {
        where: { id, docenteId, estado: { [Op.in]: desde } },
        returning: true
      });
      return filas.length ? this.recargar(id) : null;
    } catch (error) {
      if (esDuplicado(error)) {
        throw new ConflictoDeEstado("Ese juego ya pertenece a otra generación", "JUEGO_YA_ASOCIADO");
      }
      throw error;
    }
  }

  async recargar(id) {
    const fila = await GeneracionModel.findByPk(id, { include: [conReserva] });
    return fila ? this.aEntidad(plano(fila)) : null;
  }

  aEntidad(fila) {
    const sinNulo = (valor) => (valor === null ? undefined : valor);
    return new Generacion({
      id: fila.id,
      docenteId: fila.docenteId,
      canalId: fila.canalId,
      claveSolicitud: fila.claveSolicitud,
      parametros: {
        cursoId: fila.cursoId,
        estudianteId: sinNulo(fila.estudianteId),
        habilidad: fila.habilidad,
        tematica: fila.tematica,
        cantidad: fila.cantidad,
        instruccion: sinNulo(fila.instruccion)
      },
      estado: fila.estado,
      proveedor: sinNulo(fila.proveedor),
      modelo: sinNulo(fila.modelo),
      tokensEntrada: sinNulo(fila.tokensEntrada),
      tokensSalida: sinNulo(fila.tokensSalida),
      usoDesconocido: fila.usoDesconocido,
      reserva: fila.reserva
        ? {
            cuotaDiariaId: fila.reserva.cuotaDiariaId,
            cupoDiario: fila.reserva.cupoDiario,
            cuotaGlobalId: fila.reserva.cuotaGlobalId,
            montoGlobal: fila.reserva.montoGlobal,
            liberada: fila.reserva.liberada
          }
        : undefined,
      errorCodigo: sinNulo(fila.errorCodigo),
      juegoId: sinNulo(fila.juegoId),
      creadaEn: fila.creadaEn,
      finalizadaEn: sinNulo(fila.finalizadaEn),
      actualizadoEn: fila.actualizadoEn
    });
  }
}

module.exports = GeneracionRepositorySequelize;

const Juego = require("../Dominio/Entidades/Juego");
const JuegoModel = require("./JuegoModel");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

const esObjectId = (valor) => typeof valor === "string" && /^[0-9a-f]{24}$/i.test(valor);
const esUuid = (valor) => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
const esDuplicado = (error) => Boolean(error) && error.code === 11000;

const LIMITE_MAXIMO = 50;
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class JuegoRepositoryMongoose {
  async save(juego) {
    try {
      const doc = await JuegoModel.create({
        docenteId: juego.docenteId,
        cursoId: juego.cursoId,
        estudianteId: juego.estudianteId,
        generacionId: juego.generacionId,
        titulo: juego.titulo,
        habilidad: juego.habilidad,
        mecanica: juego.mecanica,
        origen: juego.origen,
        estado: juego.estado,
        versionActualId: juego.versionActualId
      });
      return this.aEntidad(doc.toObject());
    } catch (error) {
      if (esDuplicado(error)) {
        throw new ConflictoDeEstado("La generación ya tiene un juego", "GENERACION_YA_TIENE_JUEGO");
      }
      throw error;
    }
  }

  async findById(id, docenteId) {
    if (!esObjectId(id) || !esUuid(docenteId)) return null;
    const doc = await JuegoModel.findOne({ _id: id, docenteId }).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  // Excluye archivados salvo que se pida estado "archivado" o incluirArchivados.
  // Devuelve { items, total, pagina, limite }.
  async findPaginado(docenteId, filtros = {}, { pagina = 1, limite = 20 } = {}) {
    const paginaSegura = Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
    const limiteSeguro = Math.min(Number.isInteger(limite) && limite > 0 ? limite : 20, LIMITE_MAXIMO);
    const vacio = { items: [], total: 0, pagina: paginaSegura, limite: limiteSeguro };
    if (!esUuid(docenteId)) return vacio;

    const { cursoId, estudianteId, habilidad, estado, texto, incluirArchivados } = filtros;
    const filtro = { docenteId };
    if (cursoId !== undefined) {
      if (!esUuid(cursoId)) return vacio;
      filtro.cursoId = cursoId;
    }
    if (estudianteId !== undefined) {
      if (!esUuid(estudianteId)) return vacio;
      filtro.estudianteId = estudianteId;
    }
    if (typeof habilidad === "string") filtro.habilidad = habilidad;
    if (typeof estado === "string") filtro.estado = estado;
    else if (!incluirArchivados) filtro.estado = { $ne: "archivado" };
    if (typeof texto === "string" && texto.trim()) {
      filtro.titulo = { $regex: escaparRegex(texto.trim()), $options: "i" };
    }

    const [docs, total] = await Promise.all([
      JuegoModel.find(filtro)
        .sort({ actualizadoEn: -1, _id: -1 })
        .skip((paginaSegura - 1) * limiteSeguro)
        .limit(limiteSeguro)
        .lean(),
      JuegoModel.countDocuments(filtro)
    ]);
    return { items: docs.map((doc) => this.aEntidad(doc)), total, pagina: paginaSegura, limite: limiteSeguro };
  }

  // Solo el título
  async update(id, docenteId, cambios) {
    if (!esObjectId(id) || !esUuid(docenteId)) return null;
    const filtro = { _id: id, docenteId };
    const doc = cambios && cambios.titulo !== undefined
      ? await JuegoModel.findOneAndUpdate(filtro, { $set: { titulo: cambios.titulo } }, { new: true, runValidators: true }).lean()
      : await JuegoModel.findOne(filtro).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  async findByGeneracionId(generacionId, docenteId) {
    if (!esUuid(generacionId) || !esUuid(docenteId)) return null;
    const doc = await JuegoModel.findOne({ generacionId, docenteId }).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  // Condicional: no toca juegos archivados. Devuelve null si no se aplicó.
  async marcarListoConVersion(juegoId, docenteId, versionId) {
    if (!esObjectId(juegoId) || !esUuid(docenteId) || !esObjectId(versionId)) return null;
    const doc = await JuegoModel.findOneAndUpdate(
      { _id: juegoId, docenteId, estado: { $in: ["borrador", "listo"] } },
      { $set: { estado: "listo", versionActualId: versionId } },
      { new: true }
    ).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  // Desde borrador o listo. Devuelve null si no se aplicó.
  async archivar(id, docenteId) {
    if (!esObjectId(id) || !esUuid(docenteId)) return null;
    const doc = await JuegoModel.findOneAndUpdate(
      { _id: id, docenteId, estado: { $in: ["borrador", "listo"] } },
      { $set: { estado: "archivado" } },
      { new: true }
    ).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  // Vuelve a "listo" si tiene versión aprobada vigente; si no, a "borrador".
  async desarchivar(id, docenteId) {
    if (!esObjectId(id) || !esUuid(docenteId)) return null;
    const doc = await JuegoModel.findOneAndUpdate(
      { _id: id, docenteId, estado: "archivado" },
      [
        {
          $set: {
            estado: { $cond: [{ $ne: [{ $ifNull: ["$versionActualId", null] }, null] }, "listo", "borrador"] },
            actualizadoEn: "$$NOW"
          }
        }
      ],
      { new: true, updatePipeline: true }
    ).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  aEntidad(doc) {
    return new Juego({
      id: doc._id.toString(),
      docenteId: doc.docenteId.toString(),
      cursoId: doc.cursoId.toString(),
      estudianteId: doc.estudianteId ? doc.estudianteId.toString() : undefined,
      generacionId: doc.generacionId ? doc.generacionId.toString() : undefined,
      titulo: doc.titulo,
      habilidad: doc.habilidad,
      mecanica: doc.mecanica,
      origen: doc.origen,
      estado: doc.estado,
      versionActualId: doc.versionActualId ? doc.versionActualId.toString() : null,
      creadoEn: doc.creadoEn,
      actualizadoEn: doc.actualizadoEn
    });
  }
}

module.exports = JuegoRepositoryMongoose;

const VersionJuego = require("../Dominio/Entidades/VersionJuego");
const VersionJuegoModel = require("./VersionJuegoModel");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

const esObjectId = (valor) => typeof valor === "string" && /^[0-9a-f]{24}$/i.test(valor);
const esDuplicado = (error) => Boolean(error) && error.code === 11000;

// Cada intento fallido por número repetido significa que otra escritura ganó,
// así que N escrituras simultáneas necesitan como máximo N intentos.
const MAXIMO_INTENTOS_NUMERO = 25;

// La versión no guarda docenteId: toda operación se acota por juegoId, y el caso de uso
// comprueba antes la propiedad del juego con IJuegoRepository.findById(juegoId, docenteId).
class VersionRepositoryMongoose {
  // Asigna el número correlativo; ante clave duplicada de (juegoId, numero) relee y reintenta.
  async save(version) {
    for (let intento = 0; intento < MAXIMO_INTENTOS_NUMERO; intento += 1) {
      const ultima = await VersionJuegoModel.findOne({ juegoId: version.juegoId })
        .sort({ numero: -1 })
        .select("numero")
        .lean();
      const numero = ultima ? ultima.numero + 1 : 1;

      try {
        const doc = await VersionJuegoModel.create({
          juegoId: version.juegoId,
          numero,
          formatoVersion: version.formatoVersion,
          configuracion: version.configuracion,
          ejercicios: version.ejercicios.map((e) => ({ ...e })),
          estado: version.estado,
          aprobadoEn: version.aprobadoEn
        });
        return this.aEntidad(doc.toObject());
      } catch (error) {
        if (!esDuplicado(error)) throw error;
        const choqueDeNumero = error.keyPattern && "numero" in error.keyPattern;
        if (!choqueDeNumero) {
          throw new ConflictoDeEstado("El juego ya tiene un borrador activo", "BORRADOR_ACTIVO_EXISTENTE");
        }
      }
    }
    throw new ConflictoDeEstado("No se pudo asignar el número de versión", "NUMERO_VERSION_NO_ASIGNADO");
  }

  async findById(id, juegoId) {
    if (!esObjectId(id) || !esObjectId(juegoId)) return null;
    const doc = await VersionJuegoModel.findOne({ _id: id, juegoId }).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  async findByJuego(juegoId) {
    if (!esObjectId(juegoId)) return [];
    const docs = await VersionJuegoModel.find({ juegoId }).sort({ numero: -1 }).lean();
    return docs.map((doc) => this.aEntidad(doc));
  }

  async findBorradorByJuego(juegoId) {
    if (!esObjectId(juegoId)) return null;
    const doc = await VersionJuegoModel.findOne({ juegoId, estado: "borrador" }).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  // Solo los ejercicios, y solo mientras siga en borrador (una aprobada nunca se sobrescribe).
  async actualizarBorrador(id, juegoId, { ejercicios }) {
    if (!esObjectId(id) || !esObjectId(juegoId) || !Array.isArray(ejercicios)) return null;
    const doc = await VersionJuegoModel.findOneAndUpdate(
      { _id: id, juegoId, estado: "borrador" },
      { $set: { ejercicios: ejercicios.map((e) => ({ ...e })) } },
      { new: true, runValidators: true }
    ).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  // Devuelve null si ya no era borrador (otra llamada ganó o ya estaba aprobada).
  async aprobar(id, juegoId) {
    if (!esObjectId(id) || !esObjectId(juegoId)) return null;
    const doc = await VersionJuegoModel.findOneAndUpdate(
      {
        _id: id,
        juegoId,
        estado: "borrador",
        aprobadoEn: null,
        // Completa en el mismo instante de aprobar: un PUT concurrente no puede dejarla incompleta
        $expr: { $eq: [{ $size: "$ejercicios" }, "$configuracion.cantidadEjercicios"] }
      },
      { $set: { estado: "aprobada", aprobadoEn: new Date() } },
      { new: true }
    ).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  async descartar(id, juegoId) {
    if (!esObjectId(id) || !esObjectId(juegoId)) return null;
    const doc = await VersionJuegoModel.findOneAndUpdate(
      { _id: id, juegoId, estado: "borrador" },
      { $set: { estado: "descartada" } },
      { new: true }
    ).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  aEntidad(doc) {
    return new VersionJuego({
      id: doc._id.toString(),
      juegoId: doc.juegoId.toString(),
      numero: doc.numero,
      formatoVersion: doc.formatoVersion,
      configuracion: {
        habilidad: doc.configuracion.habilidad,
        mecanica: doc.configuracion.mecanica,
        tematica: doc.configuracion.tematica,
        cantidadEjercicios: doc.configuracion.cantidadEjercicios
      },
      ejercicios: doc.ejercicios || [],
      estado: doc.estado,
      aprobadoEn: doc.aprobadoEn || undefined,
      creadoEn: doc.creadoEn,
      actualizadoEn: doc.actualizadoEn
    });
  }
}

module.exports = VersionRepositoryMongoose;

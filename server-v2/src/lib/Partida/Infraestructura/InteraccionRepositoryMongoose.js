const Interaccion = require("../Dominio/Entidades/Interaccion");
const InteraccionModel = require("./InteraccionModel");

const esObjectId = (valor) => typeof valor === "string" && /^[0-9a-f]{24}$/i.test(valor);
const esUuid = (valor) => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
const esDuplicado = (error) => Boolean(error) && error.code === 11000;

class InteraccionRepositoryMongoose {
  // Idempotente: si (sesionId, operacionId, tipo) ya existe (11000) devuelve la registrada.
  // Devuelve { interaccion, esNueva }.
  async registrar(interaccion) {
    try {
      const doc = await InteraccionModel.create({
        sesionId: interaccion.sesionId,
        docenteId: interaccion.docenteId,
        canalId: interaccion.canalId,
        tipo: interaccion.tipo,
        operacionId: interaccion.operacionId
      });
      return { interaccion: this.aEntidad(doc.toObject()), esNueva: true };
    } catch (error) {
      if (!esDuplicado(error)) throw error;
      const existente = await InteraccionModel.findOne({
        sesionId: interaccion.sesionId,
        operacionId: interaccion.operacionId,
        tipo: interaccion.tipo
      }).lean();
      if (!existente) throw error;
      return { interaccion: this.aEntidad(existente), esNueva: false };
    }
  }

  async findBySesion(sesionId, docenteId) {
    if (!esObjectId(sesionId) || !esUuid(docenteId)) return [];
    const docs = await InteraccionModel.find({ sesionId, docenteId }).sort({ creadaEn: 1, _id: 1 }).lean();
    return docs.map((doc) => this.aEntidad(doc));
  }

  aEntidad(doc) {
    return new Interaccion({
      id: doc._id.toString(),
      sesionId: doc.sesionId ? doc.sesionId.toString() : undefined,
      docenteId: doc.docenteId.toString(),
      canalId: doc.canalId.toString(),
      tipo: doc.tipo,
      operacionId: doc.operacionId,
      creadaEn: doc.creadaEn
    });
  }
}

module.exports = InteraccionRepositoryMongoose;

const Canal = require("../Dominio/Entidades/Canal");
const CanalModel = require("./CanalModel");

class CanalRepositoryMongoose {
  // Idempotente: crea el canal si no existe y devuelve el existente en caso contrario.
  async asegurar(canal) {
    const doc = await CanalModel.findOneAndUpdate(
      { codigo: canal.codigo },
      { $setOnInsert: { superficie: canal.superficie, dispositivo: canal.dispositivo } },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    return this.aEntidad(doc);
  }

  async findByCodigo(codigo) {
    if (typeof codigo !== "string") return null;
    const doc = await CanalModel.findOne({ codigo }).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  async findAll() {
    const docs = await CanalModel.find().sort({ codigo: 1 }).lean();
    return docs.map((doc) => this.aEntidad(doc));
  }

  aEntidad(doc) {
    return new Canal({
      id: doc._id.toString(),
      codigo: doc.codigo,
      superficie: doc.superficie,
      dispositivo: doc.dispositivo
    });
  }
}

module.exports = CanalRepositoryMongoose;

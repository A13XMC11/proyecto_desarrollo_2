const Canal = require("../Dominio/Entidades/Canal");
const CanalModel = require("./CanalModel");
const { CANALES } = require("../../Compartido/Dominio/ValoresPermitidos");

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
    if (doc) return this.aEntidad(doc);
    // Los canales son datos fijos del sistema: si la colección se vació o se restauró sin ellos, un canal
    // válido se recrea al pedirlo en vez de fallar hasta el próximo reinicio. Un código ajeno sigue sin existir.
    const datos = CANALES.find((canal) => canal.codigo === codigo);
    return datos ? this.asegurar(new Canal(datos)) : null;
  }

  async findAll() {
    let docs = await CanalModel.find().sort({ codigo: 1 }).lean();
    if (docs.length < CANALES.length) {
      for (const datos of CANALES) await this.asegurar(new Canal(datos));
      docs = await CanalModel.find().sort({ codigo: 1 }).lean();
    }
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

const { TIPOS_INTERACCION } = require("../../../Compartido/Dominio/ValoresPermitidos");
const { enumerado, identificador } = require("../../../Compartido/Dominio/Validaciones");

class Interaccion {
  constructor({ id, sesionId, docenteId, canalId, tipo, operacionId, creadaEn }) {
    this.id = identificador(id, "id", { requerido: false });
    this.sesionId = identificador(sesionId, "sesionId", { requerido: false });
    this.docenteId = identificador(docenteId, "docenteId");
    this.canalId = identificador(canalId, "canalId");
    this.tipo = enumerado(tipo, TIPOS_INTERACCION, "tipo");
    this.operacionId = identificador(operacionId, "operacionId", { requerido: false });
    this.creadaEn = creadaEn;
  }
}

module.exports = Interaccion;

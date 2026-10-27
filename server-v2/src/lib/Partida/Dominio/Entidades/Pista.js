const { identificador } = require("../../../Compartido/Dominio/Validaciones");

class Pista {
  constructor({ ejercicioId, operacionId, creadoEn }) {
    this.ejercicioId = identificador(ejercicioId, "ejercicioId");
    this.operacionId = identificador(operacionId, "operacionId");
    this.creadoEn = creadoEn;
  }
}

module.exports = Pista;

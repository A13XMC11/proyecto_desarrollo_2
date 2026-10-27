const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { NUMEROS_INTENTO } = require("../../../Compartido/Dominio/ValoresPermitidos");
const { enumerado, identificador } = require("../../../Compartido/Dominio/Validaciones");

class Intento {
  constructor({ ejercicioId, numeroIntento, eleccion, esCorrecto, usoPista = false, operacionId, creadoEn }) {
    const valida =
      typeof eleccion === "string" ||
      (Array.isArray(eleccion) && eleccion.length > 0 && eleccion.every((x) => typeof x === "string"));
    if (!valida) throw new EntradaInvalida("eleccion debe ser texto o lista de textos");
    if (typeof esCorrecto !== "boolean") throw new EntradaInvalida("esCorrecto inválido");
    if (typeof usoPista !== "boolean") throw new EntradaInvalida("usoPista inválido");

    this.ejercicioId = identificador(ejercicioId, "ejercicioId");
    this.numeroIntento = enumerado(numeroIntento, NUMEROS_INTENTO, "numeroIntento");
    this.eleccion = Array.isArray(eleccion) ? [...eleccion] : eleccion;
    this.esCorrecto = esCorrecto;
    this.usoPista = usoPista;
    this.operacionId = identificador(operacionId, "operacionId");
    this.creadoEn = creadoEn;
  }
}

module.exports = Intento;

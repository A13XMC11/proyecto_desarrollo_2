const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { identificador } = require("../../../Compartido/Dominio/Validaciones");

function noNegativo(valor, campo) {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) {
    throw new EntradaInvalida(`${campo} inválido`);
  }
  return valor;
}

// Contador de consumo de IA. Sin docenteId es el contador global del periodo.
class Cuota {
  constructor({ id, docenteId, periodo, reservado = 0, consumido = 0, creadoEn, actualizadoEn }) {
    if (typeof periodo !== "string" || !/^\d{4}-\d{2}(-\d{2})?$/.test(periodo)) {
      throw new EntradaInvalida("periodo inválido: use AAAA-MM-DD o AAAA-MM");
    }

    this.id = identificador(id, "id", { requerido: false });
    this.docenteId = identificador(docenteId, "docenteId", { requerido: false });
    this.periodo = periodo;
    this.reservado = noNegativo(reservado, "reservado");
    this.consumido = noNegativo(consumido, "consumido");
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;
  }

  esGlobal() {
    return this.docenteId === undefined;
  }

  disponible(limite) {
    return Math.max(0, limite - this.reservado - this.consumido);
  }
}

module.exports = Cuota;

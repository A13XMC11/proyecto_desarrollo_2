const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { periodoDiario } = require("./Periodo");

const entero = (valor, campo, minimo) => {
  if (!Number.isInteger(valor) || valor < minimo) throw new EntradaInvalida(`${campo} debe ser un entero de ${minimo} o más`);
  return valor;
};
const numero = (valor, campo, { exclusivoCero = false } = {}) => {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 || (exclusivoCero && valor === 0)) {
    throw new EntradaInvalida(`${campo} debe ser un número ${exclusivoCero ? "positivo" : "no negativo"}`);
  }
  return valor;
};

// Límites y costos de la generación. Con la generación apagada (por defecto) solo cuentan los límites
// de uso; al habilitarla se exigen el tiempo límite y los valores económicos, que decide el equipo
// tras medir el modelo (S4-06 y S4-08): no hay valores por defecto que puedan costar dinero.
class ConfiguracionGeneracion {
  constructor({
    habilitada = false, maxDiarias = 3, maxSimultaneas = 1, permitirDiez = false, zonaHoraria = "America/Guayaquil",
    tiempoLimiteMs, margenConciliacionMs, presupuestoMensual, costoMaximoLlamada, tarifaEntrada, tarifaSalida
  } = {}) {
    if (typeof habilitada !== "boolean" || typeof permitirDiez !== "boolean") throw new EntradaInvalida("configuración de generación inválida");
    this.habilitada = habilitada;
    this.permitirDiez = permitirDiez;
    this.maxDiarias = entero(maxDiarias, "maxDiarias", 1);
    this.maxSimultaneas = entero(maxSimultaneas, "maxSimultaneas", 1);
    periodoDiario(new Date(), zonaHoraria); // rechaza una zona horaria inexistente al arrancar
    this.zonaHoraria = zonaHoraria;

    if (habilitada) {
      this.tiempoLimiteMs = entero(tiempoLimiteMs, "tiempoLimiteMs", 1);
      this.margenConciliacionMs = entero(margenConciliacionMs, "margenConciliacionMs", 0);
      this.presupuestoMensual = numero(presupuestoMensual, "presupuestoMensual", { exclusivoCero: true });
      this.costoMaximoLlamada = numero(costoMaximoLlamada, "costoMaximoLlamada", { exclusivoCero: true });
      this.tarifaEntrada = numero(tarifaEntrada, "tarifaEntrada");
      this.tarifaSalida = numero(tarifaSalida, "tarifaSalida");
      if (this.costoMaximoLlamada > this.presupuestoMensual) {
        throw new EntradaInvalida("costoMaximoLlamada no puede superar presupuestoMensual");
      }
    } else {
      this.tiempoLimiteMs = tiempoLimiteMs ?? 0;
      this.margenConciliacionMs = margenConciliacionMs ?? 0;
      this.presupuestoMensual = presupuestoMensual ?? 0;
      this.costoMaximoLlamada = costoMaximoLlamada ?? 0;
      this.tarifaEntrada = tarifaEntrada ?? 0;
      this.tarifaSalida = tarifaSalida ?? 0;
    }
    Object.freeze(this);
  }

  // Cuánto tiempo puede pasar una generación activa antes de considerarla interrumpida
  get vencimientoMs() {
    return this.tiempoLimiteMs + this.margenConciliacionMs;
  }

  // Costo real a partir de los tokens (tarifas por millón). undefined si el proveedor no informó el uso
  // o si lo informado no es creíble (no entero, negativo): en ese caso se trata como desconocido.
  costoDe({ tokensEntrada, tokensSalida } = {}) {
    const valido = (t) => Number.isInteger(t) && t >= 0;
    if (!valido(tokensEntrada) || !valido(tokensSalida)) return undefined;
    return (tokensEntrada / 1_000_000) * this.tarifaEntrada + (tokensSalida / 1_000_000) * this.tarifaSalida;
  }
}

module.exports = ConfiguracionGeneracion;

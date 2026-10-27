const { Op, literal } = require("sequelize");
const Cuota = require("../Dominio/Entidades/Cuota");
const CuotaModel = require("./CuotaModel");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

const esUuid = (valor) => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
const plano = (fila) => fila.get({ plain: true });

function positivo(valor, campo) {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    throw new EntradaInvalida(`${campo} debe ser un número positivo`);
  }
}

function noNegativo(valor, campo) {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) {
    throw new EntradaInvalida(`${campo} debe ser un número no negativo`);
  }
}

// docenteId nulo/indefinido = contador global
const alcance = (docenteId) => (docenteId === undefined ? null : docenteId);

class CuotaRepositorySequelize {
  async obtener(docenteId, periodo) {
    new Cuota({ docenteId: docenteId ?? undefined, periodo });
    if (docenteId != null && !esUuid(docenteId)) return null;
    const fila = await CuotaModel.findOne({ where: { docenteId: alcance(docenteId ?? undefined), periodo } });
    return fila ? this.aEntidad(plano(fila)) : null;
  }

  // Atómica: la comprobación "reservado + consumido + cantidad <= limite" y el incremento son una sola
  // sentencia UPDATE sobre una fila. PostgreSQL bloquea la fila y reevalúa la condición, por lo que dos
  // peticiones concurrentes no pueden pasar ambas si juntas superarían el límite.
  // Los números se validan antes de entrar en la expresión. Devuelve { reservada, cuota }.
  async reservar({ docenteId, periodo, cantidad, limite }) {
    new Cuota({ docenteId, periodo });
    if (docenteId != null && !esUuid(docenteId)) throw new EntradaInvalida("docenteId inválido");
    positivo(cantidad, "cantidad");
    noNegativo(limite, "limite");

    const donde = { docenteId: alcance(docenteId), periodo };
    await this.asegurarContador(donde);
    const [, filas] = await CuotaModel.update(
      { reservado: literal(`reservado + ${cantidad}`) },
      { where: { ...donde, [Op.and]: literal(`reservado + consumido + ${cantidad} <= ${limite}`) }, returning: true }
    );
    if (filas.length) return { reservada: true, cuota: this.aEntidad(plano(filas[0])) };

    const actual = await CuotaModel.findOne({ where: donde });
    return { reservada: false, cuota: this.aEntidad(plano(actual)) };
  }

  // Condicional: nunca deja "reservado" negativo. Devuelve { liberada, cuota }.
  async liberar({ cuotaId, cantidad }) {
    positivo(cantidad, "cantidad");
    if (!esUuid(cuotaId)) return { liberada: false, cuota: null };
    const [, filas] = await CuotaModel.update(
      { reservado: literal(`reservado - ${cantidad}`) },
      { where: { id: cuotaId, reservado: { [Op.gte]: cantidad } }, returning: true }
    );
    return { liberada: filas.length > 0, cuota: filas.length ? this.aEntidad(plano(filas[0])) : null };
  }

  // Pasa "cantidad" de reservado a consumido; "real" permite registrar el consumo efectivo
  // distinto de lo reservado. Condicional a que exista esa reserva. Devuelve { consumida, cuota }.
  async consumir({ cuotaId, cantidad, real = cantidad }) {
    positivo(cantidad, "cantidad");
    noNegativo(real, "real");
    if (!esUuid(cuotaId)) return { consumida: false, cuota: null };
    const [, filas] = await CuotaModel.update(
      { reservado: literal(`reservado - ${cantidad}`), consumido: literal(`consumido + ${real}`) },
      { where: { id: cuotaId, reservado: { [Op.gte]: cantidad } }, returning: true }
    );
    return { consumida: filas.length > 0, cuota: filas.length ? this.aEntidad(plano(filas[0])) : null };
  }

  // Crea el contador si no existe; si dos peticiones lo crean a la vez gana una (ON CONFLICT DO NOTHING).
  async asegurarContador({ docenteId, periodo }) {
    await CuotaModel.bulkCreate([{ docenteId, periodo }], { ignoreDuplicates: true });
  }

  aEntidad(fila) {
    return new Cuota({
      id: fila.id,
      docenteId: fila.docenteId || undefined,
      periodo: fila.periodo,
      reservado: fila.reservado,
      consumido: fila.consumido,
      creadoEn: fila.creadoEn,
      actualizadoEn: fila.actualizadoEn
    });
  }
}

module.exports = CuotaRepositorySequelize;

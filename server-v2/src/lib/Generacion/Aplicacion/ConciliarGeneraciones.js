// Completa o cierra las generaciones que quedaron activas más tiempo del permitido (por ejemplo, porque el
// servidor se reinició a mitad del proceso). No reintenta la llamada: la original pudo tener costo (§13).
// - Si el juego ya se guardó (juegos.generacionId), la generación se marca completada.
// - Si no, queda interrumpida. Si llegó a "procesando" el cupo se consume; si seguía "pendiente", se devuelve.
// Se ejecuta una vez al arrancar el servidor y, por docente, al consultar o pedir generaciones.
class ConciliarGeneraciones {
  constructor({ generacionRepository, juegoRepository, liquidarReserva }, { vencimientoMs = 5 * 60 * 1000 } = {}) {
    this.generacionRepository = generacionRepository;
    this.juegoRepository = juegoRepository;
    this.liquidarReserva = liquidarReserva;
    this.vencimientoMs = vencimientoMs;
  }

  // Todas las vencidas (arranque del servidor). Devuelve cuántas se conciliaron.
  async ejecutar(ahora = new Date()) {
    const vencidas = await this.generacionRepository.findVencidas(new Date(ahora.getTime() - this.vencimientoMs));
    for (const generacion of vencidas) await this.conciliar(generacion, ahora);
    return vencidas.length;
  }

  // Las activas de un docente
  async deDocente(docenteId, ahora = new Date()) {
    const recientes = await this.generacionRepository.findByDocente(docenteId);
    for (const generacion of recientes.filter((g) => g.estaActiva())) await this.conciliar(generacion, ahora);
  }

  // Devuelve la generación actualizada (o la misma si no estaba vencida)
  async conciliar(generacion, ahora = new Date()) {
    if (!generacion.estaActiva() || !this.estaVencida(generacion, ahora)) return generacion;
    const { id, docenteId } = generacion;

    const juego = await this.juegoRepository.findByGeneracionId(id, docenteId);
    if (juego) {
      const completada = await this.generacionRepository.marcarCompletada(id, docenteId, juego.id, { usoDesconocido: true });
      if (completada) await this.liquidarReserva.ejecutar(completada, { consumir: true });
      return completada || (await this.generacionRepository.findById(id, docenteId));
    }

    const llegoAlProveedor = generacion.estado === "procesando";
    const interrumpida = await this.generacionRepository.marcarInterrumpida(id, docenteId);
    if (interrumpida) await this.liquidarReserva.ejecutar(interrumpida, { consumir: llegoAlProveedor });
    return interrumpida || (await this.generacionRepository.findById(id, docenteId));
  }

  estaVencida(generacion, ahora) {
    const creada = generacion.creadaEn instanceof Date ? generacion.creadaEn : new Date(generacion.creadaEn);
    return Number.isNaN(creada.getTime()) || ahora.getTime() - creada.getTime() >= this.vencimientoMs;
  }
}

module.exports = ConciliarGeneraciones;

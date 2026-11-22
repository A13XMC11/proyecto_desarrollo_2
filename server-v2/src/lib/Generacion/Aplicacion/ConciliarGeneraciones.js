// Recupera lo que dejó una caída o un corte (RF-025). Sin temporizadores ni colas: se ejecuta al arrancar
// y, de forma diferida, cuando el docente consulta sus generaciones. Idempotente.
//
// Una generación activa que superó el tiempo límite más un margen:
//  - Si ya existe su juego con una versión, se completa (así una caída entre pasos no duplica el borrador).
//    Su reserva queda como está hasta conciliar el consumo real con el proveedor.
//  - Si nunca llegó a llamar al proveedor ("pendiente"), se interrumpe y la reserva vuelve.
//  - Si estaba llamando al proveedor ("procesando"), se interrumpe con consumo desconocido y la reserva se
//    mantiene. No se reintenta: la llamada original pudo tener costo.
const LOTE = 100;
const MAX_PASADAS = 50;

class ConciliarGeneraciones {
  constructor({ generacionRepository, juegoRepository, versionRepository, liberarReserva, config }) {
    Object.assign(this, { generacionRepository, juegoRepository, versionRepository, liberarReserva, config });
  }

  // docenteId opcional: limita la conciliación a las generaciones de ese docente (el filtro va en la consulta).
  // Trabaja por lotes mientras haya vencidas que se puedan resolver.
  async ejecutar({ docenteId, ahora = new Date() } = {}) {
    if (!this.config.habilitada) return { completadas: 0, interrumpidas: 0 };
    const fecha = new Date(ahora.getTime() - this.config.vencimientoMs);

    const resumen = { completadas: 0, interrumpidas: 0 };
    for (let pasada = 0; pasada < MAX_PASADAS; pasada += 1) {
      const lote = await this.generacionRepository.findVencidas(fecha, { docenteId, limite: LOTE });
      const antes = resumen.completadas + resumen.interrumpidas;
      for (const generacion of lote) {
        if (await this.completarSiTieneJuego(generacion)) resumen.completadas += 1;
        else if (await this.interrumpir(generacion)) resumen.interrumpidas += 1;
      }
      if (lote.length < LOTE || resumen.completadas + resumen.interrumpidas === antes) break;
    }
    return resumen;
  }

  async completarSiTieneJuego(generacion) {
    const juego = await this.juegoRepository.findByGeneracionId(generacion.id, generacion.docenteId);
    if (!juego || !(await this.versionRepository.findByJuego(juego.id)).length) return false;
    const uso = { usoDesconocido: true };
    return Boolean(await this.generacionRepository.marcarCompletada(generacion.id, generacion.docenteId, juego.id, uso));
  }

  // Si la transición "pendiente -> interrumpida" gana, nunca llamó al proveedor y la reserva vuelve; si no,
  // estaba llamando (o ya llamó) y se interrumpe con consumo desconocido conservando la reserva. Lo decide
  // la transición atómica, no el estado leído al listar, que pudo cambiar mientras tanto.
  async interrumpir(generacion) {
    const { id, docenteId } = generacion;
    const sinLlamar = await this.generacionRepository.marcarInterrumpidaSiPendiente(id, docenteId, { usoDesconocido: false });
    if (sinLlamar) {
      await this.liberarReserva.ejecutar(sinLlamar);
      return true;
    }
    return Boolean(await this.generacionRepository.marcarInterrumpida(id, docenteId));
  }
}

module.exports = ConciliarGeneraciones;

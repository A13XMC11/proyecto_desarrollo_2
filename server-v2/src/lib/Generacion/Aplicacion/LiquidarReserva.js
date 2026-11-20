// Cierra la reserva de cupo de una generación que terminó (completada, fallida, cancelada o interrumpida):
// - consumir: pasa lo reservado a consumido (hubo llamada al proveedor o pudo haberla)
// - si no: devuelve lo reservado (no se llegó a gastar)
// El indicador "liberada" de la reserva marca que ya se liquidó: marcarReservaLiberada solo responde la
// primera vez, así que dos liquidaciones concurrentes no descuentan dos veces.
// Lo usan ProcesarGeneracion, CancelarGeneracion y ConciliarGeneraciones; no tiene ruta propia.
class LiquidarReserva {
  constructor(generacionRepository, cuotaRepository) {
    this.generacionRepository = generacionRepository;
    this.cuotaRepository = cuotaRepository;
  }

  async ejecutar(generacion, { consumir }) {
    const reserva = generacion && generacion.reserva;
    if (!reserva || reserva.liberada) return false;
    const marcada = await this.generacionRepository.marcarReservaLiberada(generacion.id, generacion.docenteId);
    if (!marcada) return false;

    const operaciones = [
      { cuotaId: reserva.cuotaDiariaId, cantidad: reserva.cupoDiario },
      { cuotaId: reserva.cuotaGlobalId, cantidad: reserva.montoGlobal }
    ].filter((o) => o.cantidad > 0);
    for (const operacion of operaciones) {
      if (consumir) await this.cuotaRepository.consumir(operacion);
      else await this.cuotaRepository.liberar(operacion);
    }
    return true;
  }
}

module.exports = LiquidarReserva;

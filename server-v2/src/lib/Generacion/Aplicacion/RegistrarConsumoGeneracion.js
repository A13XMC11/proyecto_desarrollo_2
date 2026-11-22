// Registra el consumo de una generación que sí llamó al proveedor (RF-025).
//  - Uso conocido: el cupo diario queda consumido y la reserva global se ajusta al costo real.
//  - Uso desconocido (tiempo agotado, error del proveedor): el cupo diario queda consumido porque pudo haber
//    costo, y la reserva global se mantiene entera hasta conciliarla con la facturación del proveedor.
//    Nunca se registra como cero un consumo que no se conoce.
class RegistrarConsumoGeneracion {
  constructor(generacionRepository, cuotaRepository, config) {
    this.generacionRepository = generacionRepository;
    this.cuotaRepository = cuotaRepository;
    this.config = config;
  }

  // generacion debe traer su reserva; uso es { tokensEntrada, tokensSalida } o undefined si se desconoce
  async ejecutar(generacion, uso) {
    const { reserva } = generacion;
    if (!reserva || reserva.liberada) return;

    const costo = uso ? this.config.costoDe(uso) : undefined;
    if (costo === undefined) {
      await this.cuotaRepository.consumir({ cuotaId: reserva.cuotaDiariaId, cantidad: reserva.cupoDiario });
      return;
    }
    // Compuerta: el consumo se registra una sola vez aunque la llamada se repita
    const resuelta = await this.generacionRepository.marcarReservaLiberada(generacion.id, generacion.docenteId);
    if (!resuelta) return;
    try {
      await this.cuotaRepository.consumir({ cuotaId: reserva.cuotaDiariaId, cantidad: reserva.cupoDiario });
      await this.cuotaRepository.consumir({ cuotaId: reserva.cuotaGlobalId, cantidad: reserva.montoGlobal, real: costo });
    } catch (error) {
      // Si los contadores no se movieron, la reserva no está resuelta: se reabre para que figure pendiente de
      // conciliar en vez de darla por saldada.
      await this.generacionRepository.reabrirReserva(generacion.id, generacion.docenteId)
        .catch((e) => console.error("No se pudo reabrir la reserva de la generación", generacion.id, e));
      throw error;
    }
  }
}

module.exports = RegistrarConsumoGeneracion;

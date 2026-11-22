// Devuelve a los contadores la reserva de una generación que no llegó a llamar al proveedor.
// "liberada" actúa como compuerta: solo la primera llamada mueve cupo, aunque se repita o compita.
class LiberarReservaGeneracion {
  constructor(generacionRepository, cuotaRepository) {
    this.generacionRepository = generacionRepository;
    this.cuotaRepository = cuotaRepository;
  }

  // Devuelve true si liberó algo; false si no había reserva o ya estaba resuelta
  async ejecutar(generacion) {
    const resuelta = await this.generacionRepository.marcarReservaLiberada(generacion.id, generacion.docenteId);
    if (!resuelta || !resuelta.reserva) return false;
    const { reserva } = resuelta;
    await this.cuotaRepository.liberar({ cuotaId: reserva.cuotaDiariaId, cantidad: reserva.cupoDiario });
    await this.cuotaRepository.liberar({ cuotaId: reserva.cuotaGlobalId, cantidad: reserva.montoGlobal });
    return true;
  }
}

module.exports = LiberarReservaGeneracion;

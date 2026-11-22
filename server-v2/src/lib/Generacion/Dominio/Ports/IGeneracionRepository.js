class IGeneracionRepository {
  async save(generacion) {}
  async findById(id, docenteId) {}
  async findByDocente(docenteId, filtros) {}
  async findByClave(docenteId, claveSolicitud) {}
  async registrarReserva(id, docenteId, reserva) {}
  async marcarReservaLiberada(id, docenteId) {}
  async marcarProcesando(id, docenteId) {}
  async marcarCompletada(id, docenteId, juegoId, uso) {}
  async marcarFallida(id, docenteId, errorCodigo, uso) {}
  async marcarFallidaSiPendiente(id, docenteId, errorCodigo) {}
  async marcarInterrumpida(id, docenteId, uso) {}
  async marcarInterrumpidaSiPendiente(id, docenteId, uso) {}
  async reabrirReserva(id, docenteId) {}
  async contarActivas(docenteId) {}
  async findActivas(docenteId) {}
  async findVencidas(antesDe, { docenteId, limite } = {}) {}
}

module.exports = IGeneracionRepository;

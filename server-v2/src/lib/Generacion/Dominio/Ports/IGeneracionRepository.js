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
  async marcarInterrumpida(id, docenteId, uso) {}
  async contarActivas(docenteId) {}
  async findVencidas(antesDe) {}
}

module.exports = IGeneracionRepository;

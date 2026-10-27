class ISesionJuegoRepository {
  async save(sesion) {}
  async findById(id, docenteId) {}
  async findEnCurso(estudianteId, juegoId, docenteId) {}
  async registrarIntento(id, docenteId, intento, esperado) {}
  async registrarPista(id, docenteId, pista) {}
  async actualizarEjercicioActual(id, docenteId, indice) {}
  async finalizar(id, docenteId) {}
  async abandonar(id, docenteId) {}
  async findByFiltros(docenteId, filtros) {}
  async listarRecientes(docenteId, limite) {}
  async listarEnCurso(docenteId, limite) {}
}

module.exports = ISesionJuegoRepository;

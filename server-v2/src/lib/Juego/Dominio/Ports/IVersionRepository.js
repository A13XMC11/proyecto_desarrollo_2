class IVersionRepository {
  async save(version) {}
  async findById(id, juegoId) {}
  async findByJuego(juegoId) {}
  async findBorradorByJuego(juegoId) {}
  async actualizarBorrador(id, juegoId, cambios) {}
  async aprobar(id, juegoId) {}
  async descartar(id, juegoId) {}
  // Modo y temática de la versión más reciente (no descartada) de cada actividad: Map(juegoId -> { modoTematica, tematica })
  async findConfiguraciones(juegoIds) {}
}

module.exports = IVersionRepository;

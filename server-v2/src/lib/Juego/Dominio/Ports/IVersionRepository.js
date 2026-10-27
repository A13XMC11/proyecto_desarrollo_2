class IVersionRepository {
  async save(version) {}
  async findById(id, juegoId) {}
  async findByJuego(juegoId) {}
  async findBorradorByJuego(juegoId) {}
  async actualizarBorrador(id, juegoId, cambios) {}
  async aprobar(id, juegoId) {}
  async descartar(id, juegoId) {}
}

module.exports = IVersionRepository;

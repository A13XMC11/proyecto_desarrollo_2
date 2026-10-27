class IJuegoRepository {
  async save(juego) {}
  async findById(id, docenteId) {}
  async findPaginado(docenteId, filtros, paginacion) {}
  async update(id, docenteId, cambios) {}
  async findByGeneracionId(generacionId, docenteId) {}
  async marcarListoConVersion(juegoId, docenteId, versionId) {}
  async archivar(id, docenteId) {}
  async desarchivar(id, docenteId) {}
}

module.exports = IJuegoRepository;

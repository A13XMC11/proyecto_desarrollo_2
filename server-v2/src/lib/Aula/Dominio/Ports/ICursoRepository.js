class ICursoRepository {
  async save(curso) {}
  async findById(id, docenteId) {}
  async findAllByDocente(docenteId, filtros) {}
  async update(id, docenteId, cambios) {}
  async contarActivos(docenteId) {}
}

module.exports = ICursoRepository;

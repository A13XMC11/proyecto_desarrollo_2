class IEstudianteRepository {
  async save(estudiante) {}
  async findById(id, docenteId) {}
  async findByCurso(cursoId, docenteId, filtros) {}
  async update(id, docenteId, cambios) {}
  async contarActivosPorCurso(cursoId, docenteId) {}
}

module.exports = IEstudianteRepository;

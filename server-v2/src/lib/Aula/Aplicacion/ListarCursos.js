class ListarCursos {
  constructor(cursoRepository) {
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, filtros) {
    return await this.cursoRepository.findAllByDocente(docenteId, filtros);
  }
}

module.exports = ListarCursos;

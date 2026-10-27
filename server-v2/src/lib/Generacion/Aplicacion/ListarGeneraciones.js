class ListarGeneraciones {
  constructor(generacionRepository) {
    this.generacionRepository = generacionRepository;
  }

  async ejecutar(docenteId, filtros) {
    return await this.generacionRepository.findByDocente(docenteId, filtros);
  }
}

module.exports = ListarGeneraciones;

class ListarJuegos {
  constructor(juegoRepository) {
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, filtros, paginacion) {
    return await this.juegoRepository.findPaginado(docenteId, filtros, paginacion);
  }
}

module.exports = ListarJuegos;

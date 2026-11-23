class ListarJuegos {
  constructor(juegoRepository, versionRepository) {
    this.juegoRepository = juegoRepository;
    this.versionRepository = versionRepository;
  }

  // Cada actividad lleva el modo y la temática de su versión más reciente (la biblioteca distingue las de temática libre)
  async ejecutar(docenteId, filtros, paginacion) {
    const pagina = await this.juegoRepository.findPaginado(docenteId, filtros, paginacion);
    const configuraciones = await this.versionRepository.findConfiguraciones(pagina.items.map((juego) => juego.id));
    return { ...pagina, items: pagina.items.map((juego) => (configuraciones.has(juego.id) ? { ...juego, configuracion: configuraciones.get(juego.id) } : juego)) };
  }
}

module.exports = ListarJuegos;

// Recursos del catálogo que el docente puede usar al armar una actividad (opcionalmente de una temática)
class ListarRecursos {
  constructor(catalogo) {
    this.catalogo = catalogo;
  }

  async ejecutar({ tematica } = {}) {
    return this.catalogo.listar({ tematica: tematica || undefined });
  }
}

module.exports = ListarRecursos;

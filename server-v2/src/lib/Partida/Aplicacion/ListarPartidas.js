const { fechaOpcional } = require("../../Compartido/Dominio/Validaciones");

class ListarPartidas {
  constructor(sesionRepository) {
    this.sesionRepository = sesionRepository;
  }

  // Las fechas inválidas se rechazan (400) en lugar de aplicarse en silencio
  async ejecutar(docenteId, filtros) {
    const { desde, hasta, ...resto } = filtros || {};
    return await this.sesionRepository.findByFiltros(docenteId, {
      ...resto,
      desde: fechaOpcional(desde, "desde"),
      hasta: fechaOpcional(hasta, "hasta")
    });
  }
}

module.exports = ListarPartidas;

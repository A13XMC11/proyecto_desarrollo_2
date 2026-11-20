// Las activas vencidas se concilian antes de listar, para no mostrar "Generando" para siempre
class ListarGeneraciones {
  constructor(generacionRepository, conciliarGeneraciones) {
    this.generacionRepository = generacionRepository;
    this.conciliarGeneraciones = conciliarGeneraciones;
  }

  async ejecutar(docenteId, filtros) {
    await this.conciliarGeneraciones.deDocente(docenteId);
    return await this.generacionRepository.findByDocente(docenteId, filtros);
  }
}

module.exports = ListarGeneraciones;

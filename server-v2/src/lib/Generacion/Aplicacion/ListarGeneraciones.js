// Antes de listar, concilia las generaciones vencidas del docente (diferido, sin temporizadores):
// si una conciliación falla, la lista se entrega igual y el fallo queda en el registro del servidor.
class ListarGeneraciones {
  constructor(generacionRepository, conciliar) {
    this.generacionRepository = generacionRepository;
    this.conciliar = conciliar;
  }

  async ejecutar(docenteId, filtros) {
    await this.conciliar.ejecutar({ docenteId }).catch((error) => console.error("No se pudo conciliar las generaciones:", error));
    return await this.generacionRepository.findByDocente(docenteId, filtros);
  }
}

module.exports = ListarGeneraciones;

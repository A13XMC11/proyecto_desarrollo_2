const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

// Si la generación consultada quedó vencida (reinicio del servidor), se concilia antes de devolverla
class ObtenerGeneracion {
  constructor(generacionRepository, conciliarGeneraciones) {
    this.generacionRepository = generacionRepository;
    this.conciliarGeneraciones = conciliarGeneraciones;
  }

  async ejecutar(docenteId, id) {
    const generacion = await this.generacionRepository.findById(id, docenteId);
    if (!generacion) throw new NoEncontrado("Generación no encontrada");
    return await this.conciliarGeneraciones.conciliar(generacion);
  }
}

module.exports = ObtenerGeneracion;

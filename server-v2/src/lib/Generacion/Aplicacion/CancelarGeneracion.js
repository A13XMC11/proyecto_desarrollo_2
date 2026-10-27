const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

// Las generaciones son un registro de auditoría y consumo: eliminar es cancelar una generación activa
class CancelarGeneracion {
  constructor(generacionRepository) {
    this.generacionRepository = generacionRepository;
  }

  async ejecutar(docenteId, id) {
    const generacion = await this.generacionRepository.findById(id, docenteId);
    if (!generacion) throw new NoEncontrado("Generación no encontrada");
    const cancelada = await this.generacionRepository.marcarFallida(id, docenteId, "CANCELADA_POR_DOCENTE");
    if (!cancelada) {
      throw new ConflictoDeEstado("Solo se puede cancelar una generación activa", "GENERACION_NO_CANCELABLE");
    }
    return cancelada;
  }
}

module.exports = CancelarGeneracion;

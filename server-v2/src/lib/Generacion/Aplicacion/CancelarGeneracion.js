const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

// Las generaciones son un registro de auditoría y consumo: eliminar es cancelar una generación activa.
// Si aún no se llamó al proveedor ("pendiente") el cupo se devuelve; si ya estaba "procesando" se consume,
// porque la llamada pudo tener costo.
class CancelarGeneracion {
  constructor(generacionRepository, liquidarReserva) {
    this.generacionRepository = generacionRepository;
    this.liquidarReserva = liquidarReserva;
  }

  async ejecutar(docenteId, id) {
    const generacion = await this.generacionRepository.findById(id, docenteId);
    if (!generacion) throw new NoEncontrado("Generación no encontrada");
    const cancelada = await this.generacionRepository.marcarFallida(id, docenteId, "CANCELADA_POR_DOCENTE");
    if (!cancelada) {
      throw new ConflictoDeEstado("Solo se puede cancelar una generación activa", "GENERACION_NO_CANCELABLE");
    }
    await this.liquidarReserva.ejecutar(cancelada, { consumir: generacion.estado === "procesando" });
    return cancelada;
  }
}

module.exports = CancelarGeneracion;

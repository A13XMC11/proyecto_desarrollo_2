const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

// Las generaciones son un registro de auditoría y consumo: eliminar es cancelar una generación activa.
// Si todavía no llamó al proveedor, su reserva vuelve; si ya estaba llamando, el cupo se mantiene
// porque la llamada no se puede deshacer y pudo tener costo.
class CancelarGeneracion {
  constructor(generacionRepository, liberarReserva) {
    this.generacionRepository = generacionRepository;
    this.liberarReserva = liberarReserva;
  }

  async ejecutar(docenteId, id) {
    const generacion = await this.generacionRepository.findById(id, docenteId);
    if (!generacion) throw new NoEncontrado("Generación no encontrada");

    // La decisión de devolver la reserva la toma la transición, no el estado leído arriba: ese pudo cambiar
    // (otra petición la pasó a "procesando") y devolver cupo de una llamada en curso permitiría gastar de más.
    const sinLlamar = await this.generacionRepository.marcarFallidaSiPendiente(id, docenteId, "CANCELADA_POR_DOCENTE");
    if (sinLlamar) {
      await this.liberarReserva.ejecutar(sinLlamar);
      return sinLlamar;
    }
    const cancelada = await this.generacionRepository.marcarFallida(id, docenteId, "CANCELADA_POR_DOCENTE");
    if (!cancelada) {
      throw new ConflictoDeEstado("Solo se puede cancelar una generación activa", "GENERACION_NO_CANCELABLE");
    }
    return cancelada;
  }
}

module.exports = CancelarGeneracion;

const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

// Antes de responder, concilia las generaciones vencidas del docente (diferido, sin temporizadores):
// si una conciliación falla, la consulta se responde igual y el fallo queda en el registro del servidor.
class ObtenerGeneracion {
  constructor(generacionRepository, conciliar) {
    this.generacionRepository = generacionRepository;
    this.conciliar = conciliar;
  }

  async ejecutar(docenteId, id) {
    await this.conciliar.ejecutar({ docenteId }).catch((error) => console.error("No se pudo conciliar las generaciones:", error));
    const generacion = await this.generacionRepository.findById(id, docenteId);
    if (!generacion) throw new NoEncontrado("Generación no encontrada");
    return generacion;
  }
}

module.exports = ObtenerGeneracion;

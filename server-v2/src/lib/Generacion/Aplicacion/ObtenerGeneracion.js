const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ObtenerGeneracion {
  constructor(generacionRepository) {
    this.generacionRepository = generacionRepository;
  }

  async ejecutar(docenteId, id) {
    const generacion = await this.generacionRepository.findById(id, docenteId);
    if (!generacion) throw new NoEncontrado("Generación no encontrada");
    return generacion;
  }
}

module.exports = ObtenerGeneracion;

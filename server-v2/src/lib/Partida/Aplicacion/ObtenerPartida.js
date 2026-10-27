const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ObtenerPartida {
  constructor(sesionRepository) {
    this.sesionRepository = sesionRepository;
  }

  async ejecutar(docenteId, id) {
    const sesion = await this.sesionRepository.findById(id, docenteId);
    if (!sesion) throw new NoEncontrado("Partida no encontrada");
    return sesion;
  }
}

module.exports = ObtenerPartida;

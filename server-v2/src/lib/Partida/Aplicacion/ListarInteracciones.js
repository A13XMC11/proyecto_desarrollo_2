const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ListarInteracciones {
  constructor(interaccionRepository, sesionRepository) {
    this.interaccionRepository = interaccionRepository;
    this.sesionRepository = sesionRepository;
  }

  async ejecutar(docenteId, sesionId) {
    const sesion = await this.sesionRepository.findById(sesionId, docenteId);
    if (!sesion) throw new NoEncontrado("Partida no encontrada");
    return await this.interaccionRepository.findBySesion(sesionId, docenteId);
  }
}

module.exports = ListarInteracciones;

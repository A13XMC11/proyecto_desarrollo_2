const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ObtenerJuegoPorId {
  constructor(juegoRepository) {
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, id) {
    const juego = await this.juegoRepository.findById(id, docenteId);
    if (!juego) throw new NoEncontrado("Juego no encontrado");
    return juego;
  }
}

module.exports = ObtenerJuegoPorId;

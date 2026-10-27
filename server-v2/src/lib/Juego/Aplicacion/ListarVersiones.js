const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ListarVersiones {
  constructor(versionRepository, juegoRepository) {
    this.versionRepository = versionRepository;
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, juegoId) {
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    if (!juego) throw new NoEncontrado("Juego no encontrado");
    return await this.versionRepository.findByJuego(juego.id);
  }
}

module.exports = ListarVersiones;

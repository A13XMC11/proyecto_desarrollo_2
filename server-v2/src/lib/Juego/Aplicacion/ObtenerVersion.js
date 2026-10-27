const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ObtenerVersion {
  constructor(versionRepository, juegoRepository) {
    this.versionRepository = versionRepository;
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, juegoId, id) {
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    const version = juego ? await this.versionRepository.findById(id, juego.id) : null;
    if (!version) throw new NoEncontrado("Versión no encontrada");
    return version;
  }
}

module.exports = ObtenerVersion;

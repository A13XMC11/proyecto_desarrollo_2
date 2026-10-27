const VersionJuego = require("../Dominio/Entidades/VersionJuego");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

// Crea un borrador de versión. La habilidad y la mecánica salen del juego.
class CrearVersion {
  constructor(versionRepository, juegoRepository) {
    this.versionRepository = versionRepository;
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, juegoId, { tematica, cantidadEjercicios, ejercicios } = {}) {
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    if (!juego) throw new NoEncontrado("Juego no encontrado");

    const version = new VersionJuego({
      juegoId: juego.id,
      configuracion: { habilidad: juego.habilidad, mecanica: juego.mecanica, tematica, cantidadEjercicios },
      ejercicios
    });
    return await this.versionRepository.save(version);
  }
}

module.exports = CrearVersion;

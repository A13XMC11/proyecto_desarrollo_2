const VersionJuego = require("../Dominio/Entidades/VersionJuego");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

// Crea un borrador de versión. La habilidad y la mecánica salen del juego.
// El contenido se valida contra el catálogo; un borrador puede estar incompleto (la aprobación sí exige todo).
class CrearVersion {
  constructor(versionRepository, juegoRepository, catalogo, { permitirDiez = false } = {}) {
    this.versionRepository = versionRepository;
    this.juegoRepository = juegoRepository;
    this.catalogo = catalogo;
    this.permitirDiez = permitirDiez;
  }

  async ejecutar(docenteId, juegoId, { tematica, cantidadEjercicios, ejercicios = [] } = {}) {
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    if (!juego) throw new NoEncontrado("Juego no encontrado");

    VersionJuego.rechazarCamposDesconocidos(ejercicios);
    const version = new VersionJuego({
      juegoId: juego.id,
      configuracion: { habilidad: juego.habilidad, mecanica: juego.mecanica, tematica, cantidadEjercicios },
      ejercicios
    });
    version.validarContenido(this.catalogo, { permitirDiez: this.permitirDiez, exigirCantidad: false });
    return await this.versionRepository.save(version);
  }
}

module.exports = CrearVersion;

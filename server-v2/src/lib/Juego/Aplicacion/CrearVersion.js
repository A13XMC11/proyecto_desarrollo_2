const VersionJuego = require("../Dominio/Entidades/VersionJuego");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

// Crea un borrador de versión. La habilidad y la mecánica salen del juego.
// El contenido se valida contra el catálogo; un borrador puede estar incompleto (la aprobación sí exige todo).
class CrearVersion {
  // filtroContenido y emojisPermitidos (puertos) solo los usa la validación de una temática libre
  constructor(versionRepository, juegoRepository, catalogo, { permitirDiez = false, filtroContenido, emojisPermitidos } = {}) {
    this.versionRepository = versionRepository;
    this.juegoRepository = juegoRepository;
    this.catalogo = catalogo;
    this.permitirDiez = permitirDiez;
    this.filtroContenido = filtroContenido;
    this.emojisPermitidos = emojisPermitidos;
  }

  // modoTematica (opcional, "catalogo" por defecto): así una versión nueva de una actividad libre sigue siendo libre
  async ejecutar(docenteId, juegoId, { modoTematica, tematica, cantidadEjercicios, ejercicios = [] } = {}) {
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    if (!juego) throw new NoEncontrado("Juego no encontrado");

    VersionJuego.rechazarCamposDesconocidos(ejercicios);
    const version = new VersionJuego({
      juegoId: juego.id,
      configuracion: { habilidad: juego.habilidad, mecanica: juego.mecanica, modoTematica, tematica, cantidadEjercicios },
      ejercicios
    });
    version.validarContenido(this.catalogo, {
      permitirDiez: this.permitirDiez, exigirCantidad: false, filtroContenido: this.filtroContenido, emojisPermitidos: this.emojisPermitidos
    });
    return await this.versionRepository.save(version);
  }
}

module.exports = CrearVersion;

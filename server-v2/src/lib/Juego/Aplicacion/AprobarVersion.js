const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

// Aprobar deja la versión inmutable y la hace la vigente del juego (que pasa a "listo")
class AprobarVersion {
  constructor(versionRepository, juegoRepository) {
    this.versionRepository = versionRepository;
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, juegoId, id) {
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    const version = juego ? await this.versionRepository.findById(id, juego.id) : null;
    if (!version) throw new NoEncontrado("Versión no encontrada");
    if (juego.estado === "archivado") throw new ConflictoDeEstado("El juego está archivado", "JUEGO_ARCHIVADO");
    if (version.estado !== "borrador") {
      throw new ConflictoDeEstado("Solo se puede aprobar un borrador", "VERSION_NO_APROBABLE");
    }
    const requeridos = version.configuracion.cantidadEjercicios;
    if (version.ejercicios.length !== requeridos) {
      throw new EntradaInvalida(`La versión debe tener exactamente ${requeridos} ejercicios para aprobarse`);
    }

    const aprobada = await this.versionRepository.aprobar(id, juego.id);
    if (!aprobada) throw new ConflictoDeEstado("Solo se puede aprobar un borrador", "VERSION_NO_APROBABLE");
    const juegoListo = await this.juegoRepository.marcarListoConVersion(juego.id, docenteId, aprobada.id);
    if (!juegoListo) {
      // El juego se archivó entre la lectura y la escritura: la versión quedó aprobada pero no vigente
      throw new ConflictoDeEstado("El juego se archivó mientras se aprobaba la versión", "JUEGO_ARCHIVADO");
    }
    return { version: aprobada, juego: juegoListo };
  }
}

module.exports = AprobarVersion;

const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

// Eliminar una versión es descartarla; una aprobada nunca se elimina
class DescartarVersion {
  constructor(versionRepository, juegoRepository) {
    this.versionRepository = versionRepository;
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, juegoId, id) {
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    const version = juego ? await this.versionRepository.findById(id, juego.id) : null;
    if (!version) throw new NoEncontrado("Versión no encontrada");

    const descartada = await this.versionRepository.descartar(id, juego.id);
    if (!descartada) throw new ConflictoDeEstado("Solo se puede descartar un borrador", "VERSION_NO_DESCARTABLE");
    return descartada;
  }
}

module.exports = DescartarVersion;

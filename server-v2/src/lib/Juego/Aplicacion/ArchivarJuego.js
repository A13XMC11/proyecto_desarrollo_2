const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

// No hay borrado físico: eliminar un juego es archivarlo (sus partidas conservan la versión jugada)
class ArchivarJuego {
  constructor(juegoRepository) {
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, id) {
    const juego = await this.juegoRepository.findById(id, docenteId);
    if (!juego) throw new NoEncontrado("Juego no encontrado");
    const archivado = await this.juegoRepository.archivar(id, docenteId);
    if (!archivado) throw new ConflictoDeEstado("El juego ya está archivado", "JUEGO_YA_ARCHIVADO");
    return archivado;
  }
}

module.exports = ArchivarJuego;

const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

class DesarchivarJuego {
  constructor(juegoRepository) {
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, id) {
    const juego = await this.juegoRepository.findById(id, docenteId);
    if (!juego) throw new NoEncontrado("Juego no encontrado");
    const restaurado = await this.juegoRepository.desarchivar(id, docenteId);
    if (!restaurado) throw new ConflictoDeEstado("El juego no está archivado", "JUEGO_NO_ARCHIVADO");
    return restaurado;
  }
}

module.exports = DesarchivarJuego;

const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

// Las partidas son historial de resultados: eliminar es abandonar una partida en curso
class AbandonarPartida {
  constructor(sesionRepository) {
    this.sesionRepository = sesionRepository;
  }

  async ejecutar(docenteId, id) {
    const sesion = await this.sesionRepository.findById(id, docenteId);
    if (!sesion) throw new NoEncontrado("Partida no encontrada");
    const abandonada = await this.sesionRepository.abandonar(id, docenteId);
    if (!abandonada) throw new ConflictoDeEstado("La partida ya terminó", "PARTIDA_TERMINADA");
    return abandonada;
  }
}

module.exports = AbandonarPartida;

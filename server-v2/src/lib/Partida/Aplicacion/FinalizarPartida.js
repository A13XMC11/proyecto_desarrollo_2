const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

class FinalizarPartida {
  constructor(sesionRepository) {
    this.sesionRepository = sesionRepository;
  }

  async ejecutar(docenteId, id) {
    const sesion = await this.sesionRepository.findById(id, docenteId);
    if (!sesion) throw new NoEncontrado("Partida no encontrada");
    const finalizada = await this.sesionRepository.finalizar(id, docenteId);
    if (!finalizada) throw new ConflictoDeEstado("La partida ya terminó", "PARTIDA_TERMINADA");
    return finalizada;
  }
}

module.exports = FinalizarPartida;

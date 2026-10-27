const Interaccion = require("../Dominio/Entidades/Interaccion");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

// Registro append-only de eventos. Es idempotente por (sesión, operación, tipo).
class RegistrarInteraccion {
  constructor(interaccionRepository, canalRepository, sesionRepository) {
    this.interaccionRepository = interaccionRepository;
    this.canalRepository = canalRepository;
    this.sesionRepository = sesionRepository;
  }

  async ejecutar(docenteId, { sesionId, canal, tipo, operacionId } = {}) {
    const canalEncontrado = await this.canalRepository.findByCodigo(canal);
    if (!canalEncontrado) throw new EntradaInvalida("canal inválido");

    if (sesionId) {
      const sesion = await this.sesionRepository.findById(sesionId, docenteId);
      if (!sesion) throw new NoEncontrado("Partida no encontrada");
    }

    const interaccion = new Interaccion({ sesionId, docenteId, canalId: canalEncontrado.id, tipo, operacionId });
    return await this.interaccionRepository.registrar(interaccion);
  }
}

module.exports = RegistrarInteraccion;

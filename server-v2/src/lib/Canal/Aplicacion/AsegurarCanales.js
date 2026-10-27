const Canal = require("../Dominio/Entidades/Canal");
const { CANALES } = require("../../Compartido/Dominio/ValoresPermitidos");

// Garantiza que existan los 4 canales (superficie x dispositivo). Idempotente.
class AsegurarCanales {
  constructor(canalRepository) {
    this.canalRepository = canalRepository;
  }

  async ejecutar() {
    const canales = [];
    for (const datos of CANALES) {
      canales.push(await this.canalRepository.asegurar(new Canal(datos)));
    }
    return canales;
  }
}

module.exports = AsegurarCanales;

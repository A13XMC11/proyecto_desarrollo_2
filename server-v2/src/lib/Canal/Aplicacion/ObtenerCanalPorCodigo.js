const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ObtenerCanalPorCodigo {
  constructor(canalRepository) {
    this.canalRepository = canalRepository;
  }

  async ejecutar(codigo) {
    const canal = await this.canalRepository.findByCodigo(codigo);
    if (!canal) throw new NoEncontrado("Canal no encontrado");
    return canal;
  }
}

module.exports = ObtenerCanalPorCodigo;

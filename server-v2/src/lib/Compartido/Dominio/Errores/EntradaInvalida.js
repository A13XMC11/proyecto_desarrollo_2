const ErrorDeDominio = require("./ErrorDeDominio");

class EntradaInvalida extends ErrorDeDominio {
  constructor(mensaje, codigo = "ENTRADA_INVALIDA") {
    super(mensaje, codigo);
    this.statusCode = 400;
  }
}

module.exports = EntradaInvalida;

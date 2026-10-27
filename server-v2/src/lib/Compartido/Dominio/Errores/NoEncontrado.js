const ErrorDeDominio = require("./ErrorDeDominio");

class NoEncontrado extends ErrorDeDominio {
  constructor(mensaje, codigo = "NO_ENCONTRADO") {
    super(mensaje, codigo);
    this.statusCode = 404;
  }
}

module.exports = NoEncontrado;

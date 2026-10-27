const ErrorDeDominio = require("./ErrorDeDominio");

class NoAutenticado extends ErrorDeDominio {
  constructor(mensaje, codigo = "NO_AUTENTICADO") {
    super(mensaje, codigo);
    this.statusCode = 401;
  }
}

module.exports = NoAutenticado;

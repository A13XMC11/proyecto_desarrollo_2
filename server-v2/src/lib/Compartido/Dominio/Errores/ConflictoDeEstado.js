const ErrorDeDominio = require("./ErrorDeDominio");

class ConflictoDeEstado extends ErrorDeDominio {
  constructor(mensaje, codigo = "CONFLICTO_DE_ESTADO") {
    super(mensaje, codigo);
    this.statusCode = 409;
  }
}

module.exports = ConflictoDeEstado;

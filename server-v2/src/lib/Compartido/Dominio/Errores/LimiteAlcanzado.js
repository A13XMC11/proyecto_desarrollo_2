const ErrorDeDominio = require("./ErrorDeDominio");

class LimiteAlcanzado extends ErrorDeDominio {
  constructor(mensaje, codigo = "LIMITE_ALCANZADO") {
    super(mensaje, codigo);
    this.statusCode = 429;
  }
}

module.exports = LimiteAlcanzado;

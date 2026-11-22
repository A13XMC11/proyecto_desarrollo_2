const ErrorDeDominio = require("./ErrorDeDominio");

class ServicioNoDisponible extends ErrorDeDominio {
  constructor(mensaje, codigo = "SERVICIO_NO_DISPONIBLE") {
    super(mensaje, codigo);
    this.statusCode = 503;
  }
}

module.exports = ServicioNoDisponible;

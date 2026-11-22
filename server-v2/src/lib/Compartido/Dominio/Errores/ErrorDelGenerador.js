const ErrorDeDominio = require("./ErrorDeDominio");

// Fallo del generador de contenido (proveedor caído, respuesta inutilizable o tiempo agotado).
// El proveedor pudo haber cobrado, por lo que el consumo de la solicitud se considera desconocido.
class ErrorDelGenerador extends ErrorDeDominio {
  // uso: { proveedor, modelo, tokensEntrada, tokensSalida } cuando el proveedor sí lo informó antes de fallar
  constructor(mensaje, codigo = "GENERADOR_ERROR", uso = undefined) {
    super(mensaje, codigo);
    this.statusCode = 502;
    this.uso = uso;
  }
}

module.exports = ErrorDelGenerador;

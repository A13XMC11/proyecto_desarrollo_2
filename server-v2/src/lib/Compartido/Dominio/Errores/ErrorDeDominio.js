class ErrorDeDominio extends Error {
  constructor(mensaje, codigo = "ERROR_DE_DOMINIO") {
    super(mensaje);
    this.name = this.constructor.name;
    this.codigo = codigo;
  }
}

module.exports = ErrorDeDominio;

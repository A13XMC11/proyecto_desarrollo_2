const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { FRANJAS_EDAD, TEMATICAS } = require("../../../Compartido/Dominio/ValoresPermitidos");
const { textoPlano, enumerado, identificador } = require("../../../Compartido/Dominio/Validaciones");

class Estudiante {
  constructor({
    id, cursoId, codigoLista, apodo, franjaEdad, avatarId,
    intereses = [], archivado = false, creadoEn, actualizadoEn
  }) {
    const codigo = typeof codigoLista === "string" ? codigoLista.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{1,6}$/.test(codigo)) {
      throw new EntradaInvalida("codigoLista debe tener de 1 a 6 caracteres alfanuméricos");
    }

    const apodoLimpio = textoPlano(apodo, "apodo", { max: 20 });
    if (apodoLimpio && apodoLimpio.split(/\s+/).length > 2) {
      throw new EntradaInvalida("apodo admite como máximo 2 palabras");
    }

    if (!Array.isArray(intereses) || intereses.length > 5) {
      throw new EntradaInvalida("intereses admite como máximo 5 elementos");
    }
    intereses.forEach((interes) => enumerado(interes, TEMATICAS, "interes"));
    if (new Set(intereses).size !== intereses.length) throw new EntradaInvalida("intereses repetidos");
    if (typeof archivado !== "boolean") throw new EntradaInvalida("archivado inválido");

    this.id = identificador(id, "id", { requerido: false });
    this.cursoId = identificador(cursoId, "cursoId");
    this.codigoLista = codigo;
    this.apodo = apodoLimpio;
    this.franjaEdad = enumerado(franjaEdad, FRANJAS_EDAD, "franjaEdad");
    this.avatarId = identificador(avatarId, "avatarId");
    this.intereses = [...intereses];
    this.archivado = archivado;
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;
  }
}

module.exports = Estudiante;

const validator = require("validator");
const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { textoPlano, identificador } = require("../../../Compartido/Dominio/Validaciones");

class Docente {
  constructor({ id, nombre, correo, hash, institucion, creadoEn, actualizadoEn }) {
    const correoNormalizado = typeof correo === "string" ? correo.trim().toLowerCase() : "";
    if (!validator.isEmail(correoNormalizado)) throw new EntradaInvalida("correo inválido");

    this.id = identificador(id, "id", { requerido: false });
    this.nombre = textoPlano(nombre, "nombre", { min: 2, max: 80, requerido: true });
    this.correo = correoNormalizado;
    // Solo se carga al iniciar sesión; nunca debe salir en una respuesta
    this.hash = hash || undefined;
    this.institucion = textoPlano(institucion, "institucion", { max: 100 });
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;
  }

  // Vista pública: sin hash
  aPublico() {
    return {
      id: this.id,
      nombre: this.nombre,
      correo: this.correo,
      institucion: this.institucion
    };
  }
}

module.exports = Docente;

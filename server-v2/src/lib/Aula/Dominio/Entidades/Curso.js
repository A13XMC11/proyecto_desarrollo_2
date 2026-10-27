const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { GRADOS } = require("../../../Compartido/Dominio/ValoresPermitidos");
const { enumerado, identificador } = require("../../../Compartido/Dominio/Validaciones");

class Curso {
  constructor({ id, docenteId, grado, paralelo, anioLectivo, archivado = false, creadoEn, actualizadoEn }) {
    const letra = typeof paralelo === "string" ? paralelo.trim().toUpperCase() : "";
    if (!/^[A-Z]$/.test(letra)) throw new EntradaInvalida("paralelo debe ser una letra de la A a la Z");

    const anio = typeof anioLectivo === "string" ? anioLectivo.trim() : "";
    if (!/^\d{4}-\d{4}$/.test(anio) || Number(anio.slice(5)) !== Number(anio.slice(0, 4)) + 1) {
      throw new EntradaInvalida("anioLectivo inválido: use el formato 2026-2027");
    }
    if (typeof archivado !== "boolean") throw new EntradaInvalida("archivado inválido");

    this.id = identificador(id, "id", { requerido: false });
    this.docenteId = identificador(docenteId, "docenteId");
    this.grado = enumerado(grado, GRADOS, "grado");
    this.paralelo = letra;
    this.anioLectivo = anio;
    this.archivado = archivado;
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;
  }
}

module.exports = Curso;

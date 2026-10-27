const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const Intento = require("./Intento");
const Pista = require("./Pista");
const { ESTADOS_SESION } = require("../../../Compartido/Dominio/ValoresPermitidos");
const { enumerado, entero, identificador, fechaOpcional } = require("../../../Compartido/Dominio/Validaciones");

class SesionJuego {
  constructor({
    id, docenteId, cursoId, estudianteId, juegoId, versionId, canalInicioId,
    estado = "en_curso", ejercicioActual = 0, semilla, intentos = [], pistas = [],
    iniciadaEn, finalizadaEn, creadoEn, actualizadoEn
  }) {
    if (!Array.isArray(intentos) || !Array.isArray(pistas)) throw new EntradaInvalida("intentos o pistas inválidos");
    if (semilla !== undefined && !Number.isFinite(semilla)) throw new EntradaInvalida("semilla inválida");

    this.id = identificador(id, "id", { requerido: false });
    this.docenteId = identificador(docenteId, "docenteId");
    this.cursoId = identificador(cursoId, "cursoId");
    this.estudianteId = identificador(estudianteId, "estudianteId");
    this.juegoId = identificador(juegoId, "juegoId");
    this.versionId = identificador(versionId, "versionId");
    this.canalInicioId = identificador(canalInicioId, "canalInicioId");
    this.estado = enumerado(estado, ESTADOS_SESION, "estado");
    this.ejercicioActual = entero(ejercicioActual, "ejercicioActual", { min: 0 });
    this.semilla = semilla;
    this.intentos = intentos.map((i) => (i instanceof Intento ? i : new Intento(i)));
    this.pistas = pistas.map((p) => (p instanceof Pista ? p : new Pista(p)));
    this.iniciadaEn = fechaOpcional(iniciadaEn, "iniciadaEn");
    this.finalizadaEn = fechaOpcional(finalizadaEn, "finalizadaEn");
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;
  }

  estaEnCurso() {
    return this.estado === "en_curso";
  }

  tieneOperacion(operacionId) {
    return (
      this.intentos.some((i) => i.operacionId === operacionId) ||
      this.pistas.some((p) => p.operacionId === operacionId)
    );
  }
}

module.exports = SesionJuego;

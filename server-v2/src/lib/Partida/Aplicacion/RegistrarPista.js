const Pista = require("../Dominio/Entidades/Pista");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

// Devuelve el texto de la pista del ejercicio actual. Idempotente por operacionId.
class RegistrarPista {
  constructor(sesionRepository, versionRepository) {
    this.sesionRepository = sesionRepository;
    this.versionRepository = versionRepository;
  }

  async ejecutar(docenteId, id, { ejercicioId, operacionId } = {}) {
    const sesion = await this.sesionRepository.findById(id, docenteId);
    if (!sesion) throw new NoEncontrado("Partida no encontrada");
    if (!sesion.estaEnCurso()) throw new ConflictoDeEstado("La partida ya terminó", "PARTIDA_TERMINADA");

    const version = await this.versionRepository.findById(sesion.versionId, sesion.juegoId);
    if (!version) throw new NoEncontrado("Versión no encontrada");
    const ejercicio = version.ejercicios.find((e) => e.id === ejercicioId);
    if (!ejercicio) throw new EntradaInvalida("ejercicioId no pertenece a la versión jugada");
    if (version.ejercicios.indexOf(ejercicio) !== sesion.ejercicioActual) {
      throw new ConflictoDeEstado("Ese no es el ejercicio actual", "EJERCICIO_NO_ACTUAL");
    }
    if (!ejercicio.pista) throw new ConflictoDeEstado("El ejercicio no tiene pista", "EJERCICIO_SIN_PISTA");

    await this.sesionRepository.registrarPista(id, docenteId, new Pista({ ejercicioId, operacionId }));
    return { pista: ejercicio.pista };
  }
}

module.exports = RegistrarPista;

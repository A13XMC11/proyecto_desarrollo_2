const Intento = require("../Dominio/Entidades/Intento");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const LimiteAlcanzado = require("../../Compartido/Dominio/Errores/LimiteAlcanzado");

const INTENTOS_POR_EJERCICIO = 2;

// El servidor evalúa la respuesta: el cliente solo envía la elección. Idempotente por operacionId.
// Se avanza de ejercicio al acertar o al agotar el segundo intento; al terminar el último, la partida finaliza.
// El repositorio agrega el intento solo si la partida sigue en ese ejercicio y con ese número de intentos
// previos, de modo que peticiones simultáneas no pueden numerar igual ni superar el límite.
class RegistrarIntento {
  constructor(sesionRepository, versionRepository) {
    this.sesionRepository = sesionRepository;
    this.versionRepository = versionRepository;
  }

  async ejecutar(docenteId, id, { ejercicioId, eleccion, operacionId } = {}) {
    const sesion = await this.sesionRepository.findById(id, docenteId);
    if (!sesion) throw new NoEncontrado("Partida no encontrada");

    const version = await this.versionRepository.findById(sesion.versionId, sesion.juegoId);
    if (!version) throw new NoEncontrado("Versión no encontrada");

    // Reenvío: se devuelve el resultado original y se completa el avance si una petición anterior se cortó
    const repetido = sesion.intentos.find((i) => i.operacionId === operacionId);
    if (repetido) return await this.completarAvance(docenteId, id, version, sesion, repetido);

    if (!sesion.estaEnCurso()) throw new ConflictoDeEstado("La partida ya terminó", "PARTIDA_TERMINADA");

    const indice = version.ejercicios.findIndex((e) => e.id === ejercicioId);
    if (indice < 0) throw new EntradaInvalida("ejercicioId no pertenece a la versión jugada");
    if (indice !== sesion.ejercicioActual) {
      throw new ConflictoDeEstado("Ese no es el ejercicio actual", "EJERCICIO_NO_ACTUAL");
    }

    const previos = sesion.intentos.filter((i) => i.ejercicioId === ejercicioId);
    if (previos.length >= INTENTOS_POR_EJERCICIO) {
      throw new LimiteAlcanzado("El ejercicio ya agotó sus intentos", "INTENTOS_AGOTADOS");
    }

    const intento = new Intento({
      ejercicioId,
      numeroIntento: previos.length + 1,
      eleccion,
      esCorrecto: version.ejercicios[indice].esRespuestaCorrecta(eleccion),
      usoPista: sesion.pistas.some((p) => p.ejercicioId === ejercicioId),
      operacionId
    });

    const { registrado, sesion: actual } = await this.sesionRepository.registrarIntento(id, docenteId, intento, {
      ejercicioActual: indice,
      intentosPrevios: previos.length
    });
    if (!registrado) {
      const ganador = actual && actual.intentos.find((i) => i.operacionId === operacionId);
      if (ganador) return await this.completarAvance(docenteId, id, version, actual, ganador);
      if (actual && actual.estaEnCurso()) {
        throw new ConflictoDeEstado("La partida cambió mientras se registraba el intento; reintente", "CONCURRENCIA");
      }
      throw new ConflictoDeEstado("La partida ya terminó", "PARTIDA_TERMINADA");
    }
    return await this.completarAvance(docenteId, id, version, actual, intento);
  }

  // Idempotente: $max y el cierre condicional pueden repetirse sin efecto si ya se aplicaron
  async completarAvance(docenteId, id, version, sesion, intento) {
    const indice = version.ejercicios.findIndex((e) => e.id === intento.ejercicioId);
    const avanza = intento.esCorrecto || intento.numeroIntento === INTENTOS_POR_EJERCICIO;
    let actual = sesion;
    let terminada = !sesion.estaEnCurso();

    if (avanza && sesion.estaEnCurso()) {
      const siguiente = indice + 1;
      if (siguiente >= version.ejercicios.length) {
        const finalizada = await this.sesionRepository.finalizar(id, docenteId);
        if (finalizada) actual = finalizada;
        terminada = true;
      } else {
        actual = (await this.sesionRepository.actualizarEjercicioActual(id, docenteId, siguiente)) || sesion;
      }
    }

    return {
      esCorrecto: intento.esCorrecto,
      numeroIntento: intento.numeroIntento,
      ejercicioActual: actual.ejercicioActual,
      terminada
    };
  }
}

module.exports = RegistrarIntento;

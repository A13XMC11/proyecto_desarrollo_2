const { NUMEROS_INTENTO } = require("../../../Compartido/Dominio/ValoresPermitidos");

const MAXIMO_INTENTOS = NUMEROS_INTENTO.length;

// Indicadores descriptivos para el docente (§7.3). Nunca son una calificación: siempre numerador y denominador.
// - primerIntento: ejercicios acertados en el intento 1 / ejercicios respondidos
// - sinAyuda: ejercicios resueltos sin pista (resolverlos implica que la solución no se mostró) / respondidos
// - intentosTotales: respuestas registradas
// - completados / disponibles: finalización (un ejercicio se completa al acertarlo o al agotar los intentos)
class IndicadoresPartida {
  constructor({ respondidos = 0, primerIntento = 0, sinAyuda = 0, intentosTotales = 0, pistas = 0, completados = 0, disponibles = 0 } = {}) {
    this.respondidos = respondidos;
    this.primerIntento = primerIntento;
    this.sinAyuda = sinAyuda;
    this.intentosTotales = intentosTotales;
    this.pistas = pistas;
    this.completados = completados;
    this.disponibles = disponibles;
  }

  // sesion: SesionJuego; disponibles: ejercicios de la versión jugada
  static deSesion(sesion, disponibles) {
    const porEjercicio = new Map();
    for (const intento of sesion.intentos) {
      if (!porEjercicio.has(intento.ejercicioId)) porEjercicio.set(intento.ejercicioId, []);
      porEjercicio.get(intento.ejercicioId).push(intento);
    }
    const conPista = new Set(sesion.pistas.map((p) => p.ejercicioId));
    const ejercicios = [...porEjercicio.entries()];
    const acertado = (lista) => lista.some((i) => i.esCorrecto);

    return new IndicadoresPartida({
      respondidos: ejercicios.length,
      primerIntento: ejercicios.filter(([, lista]) => lista.some((i) => i.numeroIntento === 1 && i.esCorrecto)).length,
      sinAyuda: ejercicios.filter(([id, lista]) => acertado(lista) && !conPista.has(id)).length,
      intentosTotales: sesion.intentos.length,
      pistas: conPista.size,
      completados: ejercicios.filter(([, lista]) => acertado(lista) || lista.length >= MAXIMO_INTENTOS).length,
      disponibles: Number.isInteger(disponibles) && disponibles > 0 ? disponibles : 0
    });
  }

  // Suma de varias partidas. Quien llama decide cuáles: los resultados agregados usan solo las finalizadas
  // para no mezclar partidas incompletas (§7.3).
  static sumar(lista) {
    const total = new IndicadoresPartida();
    for (const i of lista) {
      for (const campo of Object.keys(total)) total[campo] += i[campo];
    }
    return total;
  }
}

module.exports = IndicadoresPartida;

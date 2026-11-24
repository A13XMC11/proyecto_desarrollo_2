// Sugerencia de repaso para el docente (descriptiva, nunca una calificación).
// Un ejercicio "se le dificultó" a un estudiante cuando no lo acertó en el primer intento.
// Todo se devuelve como cifras (n de d); "repasar" solo indica que se superó el umbral con datos suficientes.
const MINIMO_RESPUESTAS = 5; // por debajo de esto no se recomienda nada
const MINIMO_POR_HABILIDAD = 5;
const UMBRAL_HABILIDAD = 0.4;
const MINIMO_POR_PALABRA = 2;
const UMBRAL_PALABRA = 0.5;

const proporcion = (n, d) => (d ? n / d : 0);

// Un registro por ejercicio respondido de una partida
function respuestasDe({ habilidad, estudianteId, ejercicios, intentos, pistas }) {
  const objetivoDe = new Map(ejercicios.map((e) => [e.id, e.objetivo]));
  const conPista = new Set(pistas.map((p) => p.ejercicioId));
  const porEjercicio = new Map();
  for (const i of intentos) porEjercicio.set(i.ejercicioId, [...(porEjercicio.get(i.ejercicioId) || []), i]);

  return [...porEjercicio].map(([ejercicioId, lista]) => ({
    habilidad,
    estudianteId,
    objetivo: objetivoDe.get(ejercicioId) || undefined,
    falloPrimerIntento: !lista.some((i) => i.numeroIntento === 1 && i.esCorrecto),
    sinResolver: !lista.some((i) => i.esCorrecto),
    conPista: conPista.has(ejercicioId)
  }));
}

function resumir(respuestas, base) {
  const fallaron = respuestas.filter((r) => r.falloPrimerIntento);
  return {
    ...base,
    respondidos: respuestas.length,
    falloPrimerIntento: fallaron.length,
    sinResolver: respuestas.filter((r) => r.sinResolver).length,
    conPista: respuestas.filter((r) => r.conPista).length,
    estudiantes: new Set(fallaron.map((r) => r.estudianteId)).size
  };
}

function agrupar(respuestas, claveDe, baseDe) {
  const grupos = new Map();
  for (const r of respuestas) {
    const clave = claveDe(r);
    grupos.set(clave, [...(grupos.get(clave) || []), r]);
  }
  return [...grupos.values()].map((lista) => resumir(lista, baseDe(lista[0])));
}

// Más difícil primero; a igual proporción, el que tiene más respuestas (más confiable)
const porDificultad = (a, b) =>
  proporcion(b.falloPrimerIntento, b.respondidos) - proporcion(a.falloPrimerIntento, a.respondidos) ||
  b.respondidos - a.respondidos;

class AnalisisRepaso {
  // partidas: [{ habilidad, estudianteId, ejercicios: [{id, objetivo}], intentos, pistas }]
  static analizar(partidas) {
    const respuestas = partidas.flatMap(respuestasDe);
    if (respuestas.length < MINIMO_RESPUESTAS) {
      return { suficiente: false, respondidos: respuestas.length, habilidades: [], palabras: [] };
    }

    const habilidades = agrupar(respuestas, (r) => r.habilidad, (r) => ({ habilidad: r.habilidad }))
      .map((h) => ({
        ...h,
        repasar: h.respondidos >= MINIMO_POR_HABILIDAD && proporcion(h.falloPrimerIntento, h.respondidos) >= UMBRAL_HABILIDAD
      }))
      .sort(porDificultad);

    const palabras = agrupar(
      respuestas.filter((r) => r.objetivo),
      (r) => `${r.habilidad}\u0000${r.objetivo}`,
      (r) => ({ habilidad: r.habilidad, objetivo: r.objetivo })
    )
      .filter((p) => p.respondidos >= MINIMO_POR_PALABRA && proporcion(p.falloPrimerIntento, p.respondidos) >= UMBRAL_PALABRA)
      .map((p) => ({ ...p, repasar: true }))
      .sort(porDificultad);

    return { suficiente: true, respondidos: respuestas.length, habilidades, palabras };
  }
}

module.exports = AnalisisRepaso;

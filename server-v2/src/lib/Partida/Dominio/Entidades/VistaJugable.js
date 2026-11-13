// Vista de una versión para el modo aula: nunca incluye respuestaCorrectaId ni ordenCorrecto.
// Las opciones y piezas se mezclan con la semilla de la partida: el orden es estable al reanudar
// y no delata la respuesta (las piezas guardadas suelen venir en el orden correcto).

// Generador pseudoaleatorio determinista (mulberry32)
function generador(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mezclar(lista, semilla) {
  const azar = generador(semilla);
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Mezcla las piezas evitando, si se puede, que queden en el orden correcto
function mezclarPiezas(piezas, ordenCorrecto, semilla) {
  const mezcla = mezclar(piezas, semilla);
  const quedoResuelta = mezcla.length > 1 && mezcla.every((p, i) => p.id === ordenCorrecto[i]);
  // Rotar una posición deja todas las piezas fuera de su sitio sin perder el orden estable
  return quedoResuelta ? [...mezcla.slice(1), mezcla[0]] : mezcla;
}

function solucionDe(ejercicio) {
  if (ejercicio.tipo === "seleccionar_opcion") return ejercicio.respuestaCorrectaId;
  if (ejercicio.tipo === "ordenar_silabas") return [...ejercicio.ordenCorrecto];
  return undefined;
}

function ejercicioJugable(ejercicio, semilla, indice) {
  const base = {
    id: ejercicio.id,
    tipo: ejercicio.tipo,
    consigna: ejercicio.consigna,
    objetivo: ejercicio.objetivo,
    recursoId: ejercicio.recursoId,
    tienePista: Boolean(ejercicio.pista)
  };
  const semillaEjercicio = (semilla || 0) + indice * 7919;
  if (ejercicio.opciones) base.opciones = mezclar(ejercicio.opciones, semillaEjercicio);
  if (ejercicio.piezas) base.piezas = mezclarPiezas(ejercicio.piezas, ejercicio.ordenCorrecto, semillaEjercicio);
  return base;
}

module.exports = { ejercicioJugable, solucionDe, mezclar };

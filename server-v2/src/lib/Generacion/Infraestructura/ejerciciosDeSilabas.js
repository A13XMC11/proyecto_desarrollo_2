// Arma los ejercicios de las habilidades de sílabas (completar y contar) a partir del catálogo.
// Lo comparten el generador falso y el de IA: quien genera solo elige la palabra y el hueco; las opciones y
// la respuesta salen siempre de la división silábica aprobada, así que un conteo o una sílaba equivocados no pueden llegar.

const MARCA_HUECO = "__";
const normalizar = (texto) => String(texto).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const conIcono = (recurso) => (recurso && recurso.icono ? { icono: recurso.icono } : {});
const conPista = (pista) => (pista ? { pista } : {});
const ordenAlfabetico = (a, b) => a.localeCompare(b, "es");

const RESERVA = ["ma", "to", "la", "ri", "su", "ne"];

// Dos sílabas de otras palabras del catálogo, distintas de la correcta y de las que ya se ven en la palabra (si no,
// bastaría descartar las visibles); se prefieren las del mismo largo para que la correcta no se distinga a simple
// vista. Determinista: la misma semilla elige las mismas.
function distractoresDeSilaba(correcta, recursos, semilla = 0, visibles = []) {
  const excluidas = new Set([correcta, ...visibles].map(normalizar));
  const todas = [...new Set(recursos.flatMap((r) => r.silabas))].filter((s) => !excluidas.has(normalizar(s))).sort(ordenAlfabetico);
  const parecidas = todas.filter((s) => s.length === correcta.length);
  const candidatas = parecidas.length >= 2 ? parecidas : todas;
  if (candidatas.length < 2) return RESERVA.filter((s) => !excluidas.has(normalizar(s))).slice(0, 2);
  const inicio = Math.abs(semilla) % candidatas.length;
  return [candidatas[inicio], candidatas[(inicio + 1) % candidatas.length]];
}

function opcionesOrdenadas(textos, correcta) {
  const ordenados = [...textos].sort(ordenAlfabetico);
  return {
    opciones: ordenados.map((texto, i) => ({ id: `o${i + 1}`, texto })),
    respuestaCorrectaId: `o${ordenados.indexOf(correcta) + 1}`
  };
}

// indice: posición (desde 0) de la sílaba que falta
function completarSilaba({ id, recurso, indice, consigna, pista, recursos, semilla = 0 }) {
  const correcta = recurso.silabas[indice];
  const objetivo = recurso.silabas.map((s, i) => (i === indice ? MARCA_HUECO : s)).join(" ");
  const textos = [correcta, ...distractoresDeSilaba(correcta, recursos, semilla + indice, recurso.silabas)];
  return { id, consigna, ...conPista(pista), objetivo, recursoId: recurso.id, ...conIcono(recurso), ...opcionesOrdenadas(textos, correcta) };
}

// Tres números seguidos que contienen la cantidad real, sin bajar de 1
function opcionesDeConteo(cantidad) {
  const primero = Math.max(1, cantidad - 1);
  return [primero, primero + 1, primero + 2].map(String);
}

function contarSilabas({ id, recurso, consigna, pista }) {
  const correcta = String(recurso.silabas.length);
  return { id, consigna, ...conPista(pista), objetivo: recurso.palabra, recursoId: recurso.id, ...conIcono(recurso), ...opcionesOrdenadas(opcionesDeConteo(recurso.silabas.length), correcta) };
}

module.exports = { completarSilaba, contarSilabas, distractoresDeSilaba, opcionesDeConteo, conIcono, MARCA_HUECO };

// Actividades de temática libre fabricadas a mano para las pruebas (sin IA ni catálogo).
// Las divisiones en sílabas están escritas aquí a mano, según la ortografía del español: NO se calculan con el código que se prueba.

const MECANICAS = {
  vocales: "seleccionar_opcion", completar_silaba: "seleccionar_opcion", contar_silabas: "seleccionar_opcion", palabras_silabas: "ordenar_silabas"
};
const opciones = (...textos) => textos.map((texto, i) => ({ id: `o${i + 1}`, texto }));
const idDe = (lista, texto) => `o${lista.indexOf(texto) + 1}`;

// --- Constructores de ejercicios válidos -------------------------------------------------------------------
const VOCALES = ["a", "e", "i", "o", "u"];
const sinTilde = (t) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const vocal = (n, palabra, extra = {}) => {
  const inicial = sinTilde(palabra)[0];
  const textos = [inicial, ...VOCALES.filter((v) => v !== inicial).slice(0, 2)].map((v) => v.toUpperCase()).sort();
  return {
    id: `e${n}`, consigna: "¿Con qué vocal empieza esta palabra?", pista: "Escucha el primer sonido", objetivo: palabra,
    opciones: opciones(...textos), respuestaCorrectaId: idDe(textos, inicial.toUpperCase()), ...extra
  };
};
const RESERVA = ["to", "li", "ba", "su", "mo"];
const completar = (n, silabas, hueco, extra = {}) => {
  const correcta = silabas[hueco];
  const falsas = RESERVA.filter((s) => !silabas.includes(s)).slice(0, 2);
  const textos = [correcta, ...falsas].sort();
  // palabraId lleva la palabra completa (el estudiante no la ve): de ella el servidor calcula cuál es la sílaba que falta
  return {
    id: `e${n}`, consigna: "¿Qué sílaba falta en la palabra?", pista: "Lee en voz alta las sílabas que ya están",
    objetivo: silabas.map((s, i) => (i === hueco ? "__" : s)).join(" "), palabraId: silabas.join(""),
    opciones: opciones(...textos), respuestaCorrectaId: idDe(textos, correcta), ...extra
  };
};
const contar = (n, palabra, cantidad, extra = {}) => {
  const primero = Math.max(1, cantidad - 1);
  const textos = [primero, primero + 1, primero + 2].map(String);
  return {
    id: `e${n}`, consigna: "¿Cuántas sílabas tiene la palabra?", pista: "Aplaude una vez por cada sílaba", objetivo: palabra,
    opciones: opciones(...textos), respuestaCorrectaId: idDe(textos, String(cantidad)), ...extra
  };
};
const ordenar = (n, palabra, silabas, extra = {}) => ({
  id: `e${n}`, consigna: "Ordena las sílabas para formar la palabra", palabraId: palabra,
  piezas: silabas.map((texto, i) => ({ id: `p${i + 1}`, texto })), ordenCorrecto: silabas.map((_, i) => `p${i + 1}`), ...extra
});

// --- Actividades válidas por temática y habilidad: frutas, colores y animales -------------------------------
const TEMAS = {
  frutas: {
    vocales: ["uva", "aguacate", "uvilla", "arándano", "albaricoque"],
    completar: [[["man", "za", "na"], 1], [["na", "ran", "ja"], 0], [["plá", "ta", "no"], 2], [["me", "lón"], 1], [["du", "raz", "no"], 1]],
    contar: [["manzana", 3], ["uva", 2], ["piña", 2], ["aguacate", 4], ["papaya", 3]],
    ordenar: [["manzana", ["man", "za", "na"]], ["naranja", ["na", "ran", "ja"]], ["plátano", ["plá", "ta", "no"]], ["melón", ["me", "lón"]], ["durazno", ["du", "raz", "no"]]]
  },
  colores: {
    vocales: ["azul", "amarillo", "ocre", "oscuro", "anaranjado"],
    completar: [[["ro", "jo"], 1], [["ver", "de"], 0], [["mo", "ra", "do"], 1], [["ro", "sa", "do"], 2], [["ce", "les", "te"], 1]],
    contar: [["blanco", 2], ["negro", 2], ["celeste", 3], ["amarillo", 4], ["morado", 3]],
    ordenar: [["rojo", ["ro", "jo"]], ["verde", ["ver", "de"]], ["morado", ["mo", "ra", "do"]], ["rosado", ["ro", "sa", "do"]], ["negro", ["ne", "gro"]]]
  },
  animales: {
    vocales: ["abeja", "elefante", "iguana", "oso", "urraca"],
    completar: [[["pe", "rro"], 1], [["ga", "to"], 0], [["va", "ca"], 1], [["ga", "lli", "na"], 2], [["po", "lli", "to"], 0]],
    contar: [["perro", 2], ["gallina", 3], ["mariposa", 4], ["caballo", 3], ["oveja", 3]],
    ordenar: [["perro", ["pe", "rro"]], ["gato", ["ga", "to"]], ["vaca", ["va", "ca"]], ["gallina", ["ga", "lli", "na"]], ["pollito", ["po", "lli", "to"]]]
  }
};
const actividad = (habilidad, tema) => {
  const t = TEMAS[tema];
  if (habilidad === "vocales") return t.vocales.map((p, i) => vocal(i + 1, p));
  if (habilidad === "completar_silaba") return t.completar.map(([s, h], i) => completar(i + 1, s, h));
  if (habilidad === "contar_silabas") return t.contar.map(([p, c], i) => contar(i + 1, p, c));
  return t.ordenar.map(([p, s], i) => ordenar(i + 1, p, s));
};
const HABILIDADES = ["vocales", "completar_silaba", "contar_silabas", "palabras_silabas"];


module.exports = { MECANICAS, HABILIDADES, TEMAS, opciones, idDe, vocal, completar, contar, ordenar, actividad };

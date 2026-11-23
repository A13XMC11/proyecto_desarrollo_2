// Forma de la temática libre que escribe el docente. Espejo de la validación de FORMA del servidor (largo y letras);
// el filtro de contenido NO se replica: lo decide el servidor y el cliente muestra su mensaje.

export const MIN_TEMATICA = 3;
export const MAX_TEMATICA = 40;
export const EJEMPLOS_TEMATICA = ["frutas", "colores", "sonidos de animales", "medios de transporte"];

const SOLO_LETRAS = /^[a-záéíóúüñ]+(?: [a-záéíóúüñ]+)*$/;
const sinTildes = (texto) => texto.normalize("NFD").replace(/\p{M}/gu, "");

// Como el servidor: tilde compuesta, minúsculas, un solo espacio entre palabras y sin espacios en los bordes
export const normalizarTematica = (texto) =>
  String(texto ?? "").normalize("NFC").toLowerCase().replace(/ {2,}/g, " ").replace(/^ | $/g, "");

// Devuelve null si la forma es válida o un mensaje para el docente. Nunca repite lo escrito.
export const revisarTematica = (texto) => {
  const t = normalizarTematica(texto);
  if (t === "") return "Escribe la temática.";
  if (!SOLO_LETRAS.test(t)) return "Usa solo letras y espacios: sin números, signos ni símbolos.";
  if (t.length < MIN_TEMATICA) return `Escribe al menos ${MIN_TEMATICA} letras.`;
  if (t.length > MAX_TEMATICA) return `La temática puede tener hasta ${MAX_TEMATICA} caracteres.`;
  return null;
};

// «Sonidos de animales» se practica con los nombres de los animales (las onomatopeyas quedan fuera): se dice antes de pedirla
export const ayudaTematica = (texto) => {
  const t = sinTildes(normalizarTematica(texto));
  return /\bsonidos?\b/.test(t) && /\banimal(es)?\b/.test(t)
    ? "Con «sonidos de animales» se practicará con los nombres de los animales (perro, gato, vaca…), no con sus sonidos."
    : null;
};

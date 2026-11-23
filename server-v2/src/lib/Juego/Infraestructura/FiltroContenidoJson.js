const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const IFiltroContenido = require("../Dominio/Ports/IFiltroContenido");

const SUSTITUCIONES = { 0: "o", 1: "i", 3: "e", "@": "a", $: "s" };
const MIN_LETRAS_POR_PALABRA = 2;

// Deja el texto como una lista de palabras comparables: minúsculas, sin tildes (la ñ se conserva, "coño" no es "cono"),
// con las sustituciones comunes revertidas (m13rd@ → mierda), sin signos, y con las letras repetidas colapsadas
// (puuuta → puta). La lista de términos pasa por la misma normalización, así que ambas lados coinciden.
function palabrasDe(texto) {
  return texto
    .toLowerCase()
    .replace(/[013@$]/g, (c) => SUSTITUCIONES[c])
    .normalize("NFD")
    .replace(/ñ/g, "ñ")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zñ]+/g, " ")
    .replace(/(.)\1+/g, "$1")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Formas de una palabra para comparar: ella misma y sin plural (drogas → droga, cadáveres → cadáver)
function formas(palabra) {
  const posibles = [palabra];
  if (palabra.endsWith("es")) posibles.push(palabra.slice(0, -2));
  if (palabra.endsWith("s")) posibles.push(palabra.slice(0, -1));
  return posibles.filter((f) => f.length >= MIN_LETRAS_POR_PALABRA);
}

// Una lista mal armada es un error de despliegue: se detecta al cargar, no cuando un docente la usa
function validarDatos(datos) {
  if (!datos || typeof datos.categorias !== "object" || datos.categorias === null) {
    throw new EntradaInvalida("filtro de contenido: faltan las categorías");
  }
  const nombres = Object.keys(datos.categorias);
  const desconocidas = nombres.filter((n) => !IFiltroContenido.CATEGORIAS.includes(n));
  const faltantes = IFiltroContenido.CATEGORIAS.filter((n) => !nombres.includes(n));
  if (desconocidas.length || faltantes.length) {
    throw new EntradaInvalida(`filtro de contenido: categorías inválidas (sobran: ${desconocidas.join(", ") || "ninguna"}; faltan: ${faltantes.join(", ") || "ninguna"})`);
  }
}

class FiltroContenidoJson {
  constructor(datos = require("./filtro/terminosBloqueados.json")) {
    validarDatos(datos);
    // Primera palabra de cada término → los términos que empiezan con ella (un término puede tener varias palabras)
    this.indice = new Map();
    const vistos = new Map();
    for (const categoria of IFiltroContenido.CATEGORIAS) {
      const terminos = datos.categorias[categoria];
      if (!Array.isArray(terminos)) throw new EntradaInvalida(`filtro de contenido: ${categoria} debe ser una lista`);
      for (const termino of terminos) {
        const palabras = typeof termino === "string" ? palabrasDe(termino) : [];
        if (!palabras.length || palabras.some((p) => p.length < MIN_LETRAS_POR_PALABRA)) {
          throw new EntradaInvalida(`filtro de contenido: término inválido en ${categoria}`);
        }
        const clave = palabras.join(" ");
        if (vistos.has(clave)) {
          throw new EntradaInvalida(`filtro de contenido: un término está repetido (${categoria} y ${vistos.get(clave)})`);
        }
        vistos.set(clave, categoria);
        const entradas = this.indice.get(palabras[0]) || [];
        entradas.push({ palabras, categoria });
        this.indice.set(palabras[0], entradas);
      }
    }
  }

  // Compara por palabra completa: "arma" bloquea "arma" y "armas", no "armario" ni "alarma"
  evaluar(texto) {
    if (texto === undefined || texto === null) return { permitido: true };
    if (typeof texto !== "string") throw new EntradaInvalida("texto debe ser texto");
    const palabras = palabrasDe(texto);
    for (let i = 0; i < palabras.length; i++) {
      for (const forma of formas(palabras[i])) {
        for (const { palabras: termino, categoria } of this.indice.get(forma) || []) {
          const coincide = termino.every((t, k) => i + k < palabras.length && (k === 0 || formas(palabras[i + k]).includes(t)));
          if (coincide) return { permitido: false, categoria };
        }
      }
    }
    return { permitido: true };
  }
}

module.exports = FiltroContenidoJson;

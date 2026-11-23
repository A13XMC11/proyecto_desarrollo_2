const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const { icono } = require("../../Compartido/Dominio/Validaciones");
const IEmojisPermitidos = require("../Dominio/Ports/IEmojisPermitidos");

// Cuadrados y círculos de color: un icono así solo se distingue por el color, y ningún campo puede depender solo del color
const MUESTRAS_DE_COLOR = new Set([
  "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜", "◼", "◻", "◾", "◽", "▪", "▫",
  "🔶", "🔷", "🔸", "🔹", "🔺", "🔻"
]);

// El selector de variante (U+FE0F) solo pide la forma de emoji: con o sin él es el mismo icono
const sinVariante = (emoji) => emoji.replace(/️/g, "");

// Una lista mal armada es un error de despliegue: se detecta al cargar, no cuando un docente la usa
class EmojisPermitidosJson {
  constructor(datos = require("./emojis/emojisPermitidos.json")) {
    if (!datos || typeof datos.categorias !== "object" || datos.categorias === null) {
      throw new EntradaInvalida("emojis permitidos: faltan las categorías");
    }
    const nombres = Object.keys(datos.categorias);
    const sobran = nombres.filter((n) => !IEmojisPermitidos.CATEGORIAS.includes(n));
    const faltan = IEmojisPermitidos.CATEGORIAS.filter((n) => !nombres.includes(n));
    if (sobran.length || faltan.length) {
      throw new EntradaInvalida(`emojis permitidos: categorías inválidas (sobran: ${sobran.join(", ") || "ninguna"}; faltan: ${faltan.join(", ") || "ninguna"})`);
    }

    this.permitidos = new Map();
    for (const categoria of IEmojisPermitidos.CATEGORIAS) {
      const emojis = datos.categorias[categoria];
      if (!Array.isArray(emojis)) throw new EntradaInvalida(`emojis permitidos: ${categoria} debe ser una lista`);
      for (const emoji of emojis) {
        try {
          // Un icono vacío es válido en un ejercicio (no lleva icono), pero en la lista no tiene sentido
          if (typeof emoji !== "string" || emoji === "") throw new EntradaInvalida("icono vacío");
          icono(emoji, "icono");
        } catch {
          throw new EntradaInvalida(`emojis permitidos: un elemento de ${categoria} no es un emoji`);
        }
        const clave = sinVariante(emoji);
        if (MUESTRAS_DE_COLOR.has(clave)) throw new EntradaInvalida(`emojis permitidos: ${categoria} incluye un color suelto`);
        if (this.permitidos.has(clave)) {
          throw new EntradaInvalida(`emojis permitidos: un icono está repetido (${categoria} y ${this.permitidos.get(clave)})`);
        }
        this.permitidos.set(clave, categoria);
      }
    }
  }

  esPermitido(emoji) {
    return typeof emoji === "string" && this.permitidos.has(sinVariante(emoji));
  }
}

module.exports = EmojisPermitidosJson;

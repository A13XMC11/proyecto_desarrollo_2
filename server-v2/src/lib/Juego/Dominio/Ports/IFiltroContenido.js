// Filtro de contenido inapropiado para niños de 5 a 7 años. Es una defensa PARCIAL: una lista de términos no
// detecta todo lo inadecuado ni todo lo que bloquea lo es. La aprobación del docente es la garantía real.
class IFiltroContenido {
  // Evalúa un texto corto (una temática, una palabra). Devuelve { permitido: true } o
  // { permitido: false, categoria }. Nunca incluye el término ni el texto evaluado en el resultado.
  evaluar(texto) {}
}

// Categorías de bloqueo, en el orden en que se revisan
IFiltroContenido.CATEGORIAS = [
  "politica", "religion", "violencia", "armas", "drogas_alcohol",
  "sexualidad", "enfermedades_salud", "muerte_miedo", "marcas_comerciales", "insultos"
];

module.exports = IFiltroContenido;

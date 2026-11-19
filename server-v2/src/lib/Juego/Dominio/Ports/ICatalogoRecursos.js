// Catálogo revisado de recursos (palabras, vocal inicial y división silábica aprobada).
// Un recurso es { id, palabra, tematica, silabas: [texto], vocalInicial? }; vocalInicial solo existe
// cuando la palabra empieza con vocal.
class ICatalogoRecursos {
  // Devuelve el recurso o undefined
  obtenerRecurso(id) {}

  // Lista los recursos, opcionalmente de una temática
  listar({ tematica } = {}) {}
}

module.exports = ICatalogoRecursos;

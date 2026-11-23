// Lista cerrada de emojis infantiles seguros que pueden ilustrar un ejercicio de temática libre.
// Un icono es opcional; si viene, debe estar en esta lista.
class IEmojisPermitidos {
  // true solo si `emoji` es exactamente un icono de la lista (con o sin selector de variante)
  esPermitido(emoji) {}
}

// Categorías de la lista, en el orden en que se muestran a quien la revisa
IEmojisPermitidos.CATEGORIAS = [
  "animales", "frutas", "verduras", "objetos", "naturaleza", "cuerpo", "escuela", "comida", "transporte", "juguetes"
];

module.exports = IEmojisPermitidos;

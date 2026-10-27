const fs = require("node:fs");
const path = require("node:path");

const LIB = path.join(__dirname, "../../lib");

// Code first: los modelos son la fuente de verdad del esquema. Para crear tablas, colecciones
// e índices hay que haberlos cargado todos, también los de módulos que aún no exponen rutas.
function cargarModelos() {
  const modelos = [];
  for (const modulo of fs.readdirSync(LIB, { withFileTypes: true })) {
    const carpeta = path.join(LIB, modulo.name, "Infraestructura");
    if (!modulo.isDirectory() || !fs.existsSync(carpeta)) continue;
    for (const archivo of fs.readdirSync(carpeta)) {
      if (archivo.endsWith("Model.js")) modelos.push(require(path.join(carpeta, archivo)));
    }
  }
  return modelos;
}

module.exports = cargarModelos;

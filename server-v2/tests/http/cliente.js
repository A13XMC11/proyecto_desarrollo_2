const { before, after } = require("node:test");
const buildApp = require("../../src/app");

// Cliente HTTP de pruebas: levanta buildApp() en un puerto efímero (sin puerto fijo) y lo cierra al terminar.
function conServidor() {
  let servidor;
  let base;

  before(async () => {
    servidor = buildApp().listen(0);
    await new Promise((resolve) => servidor.once("listening", resolve));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => servidor.close());

  return async (ruta, { metodo = "GET", cuerpo, docente, cabeceras } = {}) => {
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: { "content-type": "application/json", ...(docente && { "x-docente-id": docente }), ...cabeceras },
      body: cuerpo && JSON.stringify(cuerpo)
    });
    const texto = await respuesta.text();
    return { status: respuesta.status, cuerpo: texto ? JSON.parse(texto) : undefined };
  };
}

let contador = 0;
const correo = () => `docente${Date.now()}${++contador}@escuela.ec`;

async function registrarDocente(llamar, extra = {}) {
  const r = await llamar("/api/docentes", {
    metodo: "POST",
    cuerpo: { nombre: "Ana Pérez", correo: correo(), contrasena: "clave12345", ...extra }
  });
  return r.cuerpo.id;
}

module.exports = { conServidor, registrarDocente };

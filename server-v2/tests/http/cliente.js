const { before, after } = require("node:test");
const buildApp = require("../../src/app");

// Cliente HTTP de pruebas: levanta buildApp() en un puerto efímero (sin puerto fijo) y lo cierra al terminar.
// Funciona como un navegador por docente: guarda la cookie de sesión y el token CSRF que recibe al registrarse
// o entrar, y los envía cuando una prueba llama con { docente: id }.
function conServidor() {
  let servidor;
  let base;
  const sesiones = new Map(); // docenteId -> { cookie, csrf }

  before(async () => {
    servidor = buildApp().listen(0);
    await new Promise((resolve) => servidor.once("listening", resolve));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => servidor.close());

  // sinCsrf: omite el token para comprobar que el servidor lo exige
  return async (ruta, { metodo = "GET", cuerpo, docente, cabeceras, sinCsrf = false } = {}) => {
    const sesion = docente && sesiones.get(docente);
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: {
        "content-type": "application/json",
        ...(sesion && { cookie: sesion.cookie }),
        ...(sesion && !sinCsrf && { "x-csrf-token": sesion.csrf }),
        ...cabeceras
      },
      body: cuerpo && JSON.stringify(cuerpo)
    });
    const texto = await respuesta.text();
    const datos = texto ? JSON.parse(texto) : undefined;

    // Una sesión nueva llega con Set-Cookie y X-CSRF-Token al registrarse o entrar
    const cookie = respuesta.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("letritas.sid="));
    const csrf = respuesta.headers.get("x-csrf-token");
    const dueno = datos && datos.id && ["/api/docentes", "/api/docentes/sesion"].includes(ruta) && metodo === "POST" ? datos.id : docente;
    if (cookie && csrf && dueno) sesiones.set(dueno, { cookie, csrf });

    return { status: respuesta.status, cuerpo: datos, cabeceras: respuesta.headers };
  };
}

let contador = 0;
const correo = () => `docente${Date.now()}${++contador}@escuela.ec`;

// Registra un docente (lo que también le abre la sesión) y devuelve su id
async function registrarDocente(llamar, extra = {}) {
  const r = await llamar("/api/docentes", {
    metodo: "POST",
    cuerpo: { nombre: "Ana Pérez", correo: correo(), contrasena: "clave12345", ...extra }
  });
  return r.cuerpo.id;
}

module.exports = { conServidor, registrarDocente };

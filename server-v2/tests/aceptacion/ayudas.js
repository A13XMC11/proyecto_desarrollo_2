const buildApp = require("../../src/app");

// Ayudas de las pruebas de aceptación. Se parecen a tests/http/cliente.js pero permiten REINICIAR el servidor
// (cerrarlo y levantar otro sobre las mismas bases), que es lo que exige el criterio de cierre del sprint 6.

// Un servidor real escuchando en un puerto libre. cerrar() corta también las conexiones abiertas, como un reinicio.
async function levantarServidor() {
  const http = buildApp().listen(0);
  await new Promise((resolver) => http.once("listening", resolver));
  return {
    base: `http://127.0.0.1:${http.address().port}`,
    cerrar: () => new Promise((resolver) => { http.closeAllConnections(); http.close(resolver); })
  };
}

// Un «navegador»: guarda la cookie de sesión y el token CSRF, y los envía en cada petición
function crearNavegador(servidor) {
  const estado = { cookie: undefined, csrf: undefined };
  const navegador = {
    servidor,
    estado,
    // Tras un reinicio del servidor el navegador es el mismo: conserva su cookie y su token
    apuntarA(nuevo) { navegador.servidor = nuevo; },
    async llamar(ruta, { metodo = "GET", cuerpo, cabeceras } = {}) {
      const respuesta = await fetch(navegador.servidor.base + ruta, {
        method: metodo,
        headers: {
          "content-type": "application/json",
          ...(estado.cookie && { cookie: estado.cookie, "x-csrf-token": estado.csrf }),
          ...cabeceras
        },
        body: cuerpo && JSON.stringify(cuerpo)
      });
      const texto = await respuesta.text();
      const cookie = respuesta.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("letritas.sid="));
      const csrf = respuesta.headers.get("x-csrf-token");
      if (cookie && csrf) Object.assign(estado, { cookie, csrf });
      return { status: respuesta.status, cuerpo: texto ? JSON.parse(texto) : undefined };
    }
  };
  return navegador;
}

let contador = 0;
async function registrarDocente(navegador, extra = {}) {
  const r = await navegador.llamar("/api/docentes", {
    metodo: "POST",
    cuerpo: { nombre: "Ana Pérez", correo: `aceptacion${Date.now()}${++contador}@escuela.ec`, contrasena: "clave12345", ...extra }
  });
  if (r.status !== 201) throw new Error(`no se pudo registrar el docente: ${r.status} ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.id;
}

// Docente con curso, tres estudiantes y una actividad aprobada lista para jugar
async function prepararAula(navegador, { habilidad = "vocales", ejercicios, tematica = "animales" } = {}) {
  const exigir = (r, que) => {
    if (![200, 201].includes(r.status)) throw new Error(`${que}: ${r.status} ${JSON.stringify(r.cuerpo)}`);
    return r.cuerpo;
  };
  const curso = exigir(await navegador.llamar("/api/cursos", { metodo: "POST", cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } }), "curso").id;
  const estudiantes = [];
  for (const codigo of ["A01", "A02", "A03"]) {
    estudiantes.push(exigir(await navegador.llamar("/api/estudiantes", { metodo: "POST", cuerpo: { cursoId: curso, codigoLista: codigo, franjaEdad: 6, avatarId: "gato" } }), "estudiante").id);
  }
  const juego = exigir(await navegador.llamar("/api/juegos", { metodo: "POST", cuerpo: { cursoId: curso, titulo: "Las vocales de los animales", habilidad } }), "juego").id;
  const version = exigir(await navegador.llamar(`/api/juegos/${juego}/versiones`, { metodo: "POST", cuerpo: { tematica, cantidadEjercicios: ejercicios.length, ejercicios } }), "versión").id;
  exigir(await navegador.llamar(`/api/juegos/${juego}/versiones/${version}/aprobar`, { metodo: "POST" }), "aprobar");
  return { curso, estudiantes, juego, version };
}

module.exports = { levantarServidor, crearNavegador, registrarDocente, prepararAula };

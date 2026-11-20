const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const requerirDocente = require("../../../src/Infraestructura/http/requerirDocente");
const { DURACION_MAXIMA_MS } = require("../../../src/Infraestructura/http/sesion");

const DOCENTE = "11111111-1111-4111-8111-111111111111";
const TOKEN = "a".repeat(64);

// Petición falsa con la forma que deja express-session
function peticion({ metodo = "GET", sesion, cabeceras = {} } = {}) {
  const req = {
    method: metodo,
    session: sesion && { ...sesion, destroy: (cb) => { req.sesionDestruida = true; cb(); } },
    get: (nombre) => cabeceras[nombre.toLowerCase()]
  };
  return req;
}

const ejecutar = (req) => new Promise((resolver) => requerirDocente(req, {}, (error) => resolver(error)));
const sesionValida = () => ({ docenteId: DOCENTE, iniciadaEn: Date.now(), csrf: TOKEN });

describe("requerirDocente (sesión con cookie)", () => {
  it("sin sesión responde 401", async () => {
    const error = await ejecutar(peticion());
    assert.equal(error.statusCode, 401);
    assert.equal(error.codigo, "SESION_REQUERIDA");
  });

  it("ignora la cabecera x-docente-id: nadie se hace pasar por otro docente", async () => {
    const req = peticion({ cabeceras: { "x-docente-id": DOCENTE } });
    assert.equal((await ejecutar(req)).statusCode, 401);
    assert.equal(req.docenteId, undefined);
  });

  it("con sesión válida identifica al docente en las lecturas", async () => {
    const req = peticion({ sesion: sesionValida() });
    assert.equal(await ejecutar(req), undefined);
    assert.equal(req.docenteId, DOCENTE);
  });

  it("las operaciones que cambian datos exigen el token CSRF de la sesión", async () => {
    for (const metodo of ["POST", "PUT", "DELETE"]) {
      assert.equal((await ejecutar(peticion({ metodo, sesion: sesionValida() }))).statusCode, 403, `${metodo} sin token`);
      const otro = peticion({ metodo, sesion: sesionValida(), cabeceras: { "x-csrf-token": "b".repeat(64) } });
      assert.equal((await ejecutar(otro)).codigo, "CSRF_INVALIDO", `${metodo} con token ajeno`);
      const bueno = peticion({ metodo, sesion: sesionValida(), cabeceras: { "x-csrf-token": TOKEN } });
      assert.equal(await ejecutar(bueno), undefined, `${metodo} con su token`);
    }
  });

  it("a las 12 horas la sesión se destruye aunque haya actividad", async () => {
    const req = peticion({ sesion: { ...sesionValida(), iniciadaEn: Date.now() - DURACION_MAXIMA_MS - 1000 } });
    const error = await ejecutar(req);
    assert.equal(error.statusCode, 401);
    assert.equal(error.codigo, "SESION_EXPIRADA");
    assert.equal(req.sesionDestruida, true);
  });
});

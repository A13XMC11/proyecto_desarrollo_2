const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor } = require("./cliente");

const prueba = pruebasConBase("api", { sql: true, mongo: true });
const llamar = conServidor();

describe("Contrato HTTP: generalidades", () => {
  prueba("health, 404 y rutas protegidas sin docente (401)", async () => {
    assert.deepEqual((await llamar("/api/health")).cuerpo, { ok: true });
    assert.equal((await llamar("/api/nada")).status, 404);
    for (const ruta of ["/api/docentes", "/api/cursos", "/api/estudiantes", "/api/juegos", "/api/partidas", "/api/generaciones", "/api/cuotas", "/api/interacciones"]) {
      assert.equal((await llamar(ruta)).status, 401, ruta);
    }
    assert.equal((await llamar("/api/canales")).status, 200, "el catálogo de canales es público");
  });
});

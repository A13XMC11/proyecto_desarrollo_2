import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { esFaltaDeConexion } from "./clienteHttp.js";

describe("esFaltaDeConexion", () => {
  it("un 502-504 sin cuerpo de la API (proxy) es falta de conexión", () => {
    for (const estado of [502, 503, 504]) {
      assert.equal(esFaltaDeConexion(estado, null), true, String(estado));
      assert.equal(esFaltaDeConexion(estado, {}), true, String(estado));
    }
  });

  it("un 503 con el mensaje de la API se muestra tal cual, no como falta de conexión", () => {
    assert.equal(esFaltaDeConexion(503, { message: "El servicio no está disponible por ahora." }), false);
  });

  it("otros estados nunca son falta de conexión", () => {
    for (const estado of [400, 401, 404, 409, 500]) assert.equal(esFaltaDeConexion(estado, null), false, String(estado));
  });
});

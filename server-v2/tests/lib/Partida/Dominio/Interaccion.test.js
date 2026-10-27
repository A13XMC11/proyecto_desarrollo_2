const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Interaccion = require("../../../../src/lib/Partida/Dominio/Entidades/Interaccion");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

describe("Entidad Interaccion", () => {
  const base = { docenteId: "d", canalId: "k", tipo: "intento" };

  it("la sesión y la operación son opcionales", () => {
    const i = new Interaccion(base);
    assert.equal(i.sesionId, undefined);
    assert.equal(new Interaccion({ ...base, sesionId: "s", operacionId: "o" }).operacionId, "o");
  });

  it("rechaza tipos desconocidos o datos faltantes", () => {
    assert.throws(() => new Interaccion({ ...base, tipo: "baile" }), EntradaInvalida);
    assert.throws(() => new Interaccion({ ...base, docenteId: undefined }), EntradaInvalida);
    assert.throws(() => new Interaccion({ ...base, canalId: undefined }), EntradaInvalida);
  });
});

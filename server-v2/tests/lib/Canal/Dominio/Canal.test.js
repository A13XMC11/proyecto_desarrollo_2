const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Canal = require("../../../../src/lib/Canal/Dominio/Entidades/Canal");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

describe("Entidad Canal", () => {
  it("acepta los 4 canales coherentes", () => {
    for (const s of ["docente", "aula"]) {
      for (const d of ["computador", "tableta"]) {
        assert.equal(new Canal({ codigo: `${s}_${d}`, superficie: s, dispositivo: d }).codigo, `${s}_${d}`);
      }
    }
  });

  it("rechaza códigos incoherentes o desconocidos", () => {
    assert.throws(() => new Canal({ codigo: "aula_tableta", superficie: "docente", dispositivo: "tableta" }), EntradaInvalida);
    assert.throws(() => new Canal({ codigo: "otro", superficie: "aula", dispositivo: "tableta" }), EntradaInvalida);
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const IFiltroContenido = require("../../../../src/lib/Juego/Dominio/Ports/IFiltroContenido");

describe("IFiltroContenido (puerto)", () => {
  it("expone evaluar(texto) y las categorías de bloqueo, en un orden fijo", () => {
    assert.equal(typeof new IFiltroContenido().evaluar, "function");
    assert.deepEqual(IFiltroContenido.CATEGORIAS, [
      "politica", "religion", "violencia", "armas", "drogas_alcohol",
      "sexualidad", "enfermedades_salud", "muerte_miedo", "marcas_comerciales", "insultos"
    ]);
  });
});

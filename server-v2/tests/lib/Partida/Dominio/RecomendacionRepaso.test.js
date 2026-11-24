const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const RecomendacionRepaso = require("../../../../src/lib/Partida/Dominio/Entidades/RecomendacionRepaso");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const valida = {
  resumen: "La mayoría falla al contar las sílabas de palabras largas.",
  sugerencias: ["Practicar palmadas por sílaba con palabras de tres sílabas.", "Repasar «mariposa» con apoyo de dibujos."]
};

describe("RecomendacionRepaso (lo que devuelve la IA es una propuesta no confiable)", () => {
  it("acepta un resumen y de una a tres sugerencias, y recorta espacios", () => {
    const r = new RecomendacionRepaso({ resumen: `  ${valida.resumen}  `, sugerencias: valida.sugerencias });
    assert.equal(r.resumen, valida.resumen);
    assert.equal(r.sugerencias.length, 2);
  });

  it("descarta los campos que no son del contrato", () => {
    const r = new RecomendacionRepaso({ ...valida, script: "alert(1)", html: "<b>" });
    assert.deepEqual(Object.keys(r).sort(), ["resumen", "sugerencias"]);
  });

  it("rechaza HTML, enlaces y correos", () => {
    for (const malo of ["Mira <b>esto</b> con calma ahora", "Entra a https://malo.example para ver más", "Escribe a x@y.com para ayuda"]) {
      assert.throws(() => new RecomendacionRepaso({ ...valida, resumen: malo }), EntradaInvalida, malo);
      assert.throws(() => new RecomendacionRepaso({ ...valida, sugerencias: [malo] }), EntradaInvalida, malo);
    }
  });

  it("rechaza resumen ausente o excesivo y listas vacías, largas o con tipos raros", () => {
    assert.throws(() => new RecomendacionRepaso({ sugerencias: valida.sugerencias }), EntradaInvalida);
    assert.throws(() => new RecomendacionRepaso({ ...valida, resumen: "x".repeat(501) }), EntradaInvalida);
    assert.throws(() => new RecomendacionRepaso({ ...valida, sugerencias: [] }), EntradaInvalida);
    assert.throws(() => new RecomendacionRepaso({ ...valida, sugerencias: Array(4).fill("Sugerencia válida de ejemplo") }), EntradaInvalida);
    assert.throws(() => new RecomendacionRepaso({ ...valida, sugerencias: "una sola" }), EntradaInvalida);
    assert.throws(() => new RecomendacionRepaso({ ...valida, sugerencias: [42] }), EntradaInvalida);
    assert.throws(() => new RecomendacionRepaso(null), EntradaInvalida);
  });
});

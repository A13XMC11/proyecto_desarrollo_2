const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const ErrorDeDominio = require("../../../../src/lib/Compartido/Dominio/Errores/ErrorDeDominio");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");
const NoAutenticado = require("../../../../src/lib/Compartido/Dominio/Errores/NoAutenticado");
const NoEncontrado = require("../../../../src/lib/Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../../../src/lib/Compartido/Dominio/Errores/ConflictoDeEstado");
const LimiteAlcanzado = require("../../../../src/lib/Compartido/Dominio/Errores/LimiteAlcanzado");
const { textoPlano, enumerado, entero } = require("../../../../src/lib/Compartido/Dominio/Validaciones");
const valores = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");
const reexportados = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");

describe("Compartido: errores de dominio", () => {
  it("cada subclase hereda de ErrorDeDominio y lleva un codigo estable", () => {
    const casos = [
      [EntradaInvalida, "ENTRADA_INVALIDA"],
      [NoAutenticado, "NO_AUTENTICADO"],
      [NoEncontrado, "NO_ENCONTRADO"],
      [ConflictoDeEstado, "CONFLICTO_DE_ESTADO"],
      [LimiteAlcanzado, "LIMITE_ALCANZADO"]
    ];
    for (const [Clase, codigo] of casos) {
      const error = new Clase("mensaje");
      assert.ok(error instanceof ErrorDeDominio);
      assert.ok(error instanceof Error);
      assert.equal(error.codigo, codigo);
      assert.equal(error.message, "mensaje");
      assert.equal(error.name, Clase.name);
    }
  });

  it("admite un codigo específico", () => {
    assert.equal(new LimiteAlcanzado("x", "CUPO_DIARIO_AGOTADO").codigo, "CUPO_DIARIO_AGOTADO");
  });
});

describe("Compartido: validaciones", () => {
  it("textoPlano recorta y rechaza HTML, URLs y correos", () => {
    assert.equal(textoPlano("  hola  ", "x", { requerido: true }), "hola");
    for (const malo of ["<b>hola</b>", "visita http://x.com", "www.sitio.ec", "a@b.com"]) {
      assert.throws(() => textoPlano(malo, "x"), EntradaInvalida);
    }
  });

  it("textoPlano respeta mínimo, máximo y obligatoriedad", () => {
    assert.throws(() => textoPlano("a", "x", { min: 2 }), EntradaInvalida);
    assert.throws(() => textoPlano("abcd", "x", { max: 3 }), EntradaInvalida);
    assert.throws(() => textoPlano("", "x", { requerido: true }), EntradaInvalida);
    assert.throws(() => textoPlano(5, "x"), EntradaInvalida);
    assert.equal(textoPlano(undefined, "x"), undefined);
  });

  it("enumerado y entero validan", () => {
    assert.equal(enumerado("a", ["a", "b"], "x"), "a");
    assert.throws(() => enumerado("c", ["a", "b"], "x"), EntradaInvalida);
    assert.equal(enumerado(undefined, ["a"], "x", { requerido: false }), undefined);
    assert.throws(() => entero(1.5, "x"), EntradaInvalida);
    assert.throws(() => entero(0, "x", { min: 1 }), EntradaInvalida);
  });

  it("Infraestructura reexporta exactamente los valores de Compartido", () => {
    assert.equal(reexportados, valores);
    assert.deepEqual(valores.CODIGOS_CANAL.length, 4);
  });
});

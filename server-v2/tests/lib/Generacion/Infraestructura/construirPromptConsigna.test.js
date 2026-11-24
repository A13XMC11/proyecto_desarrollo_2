const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { construirPromptGeneracion } = require("../../../../src/lib/Generacion/Infraestructura/construirPromptGeneracion");
const CatalogoRecursosJson = require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const { COMPATIBILIDAD } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");

const catalogo = new CatalogoRecursosJson();
const REGLA = /nunca escriben sílabas, letras sueltas ni partes de la palabra/;

describe("prompt: la consigna no escribe sílabas ni partes de la palabra", () => {
  it("la regla está en el prompt de las 4 habilidades del catálogo", () => {
    for (const habilidad of Object.keys(COMPATIBILIDAD)) {
      const { sistema } = construirPromptGeneracion({ habilidad, mecanica: COMPATIBILIDAD[habilidad], tematica: "animales", cantidad: 5, recursos: catalogo.listar({ tematica: "animales" }) });
      assert.match(sistema, REGLA, habilidad);
    }
  });

  it("y en el de la temática libre", () => {
    const { sistema } = construirPromptGeneracion({ modoTematica: "libre", habilidad: "vocales", mecanica: COMPATIBILIDAD.vocales, tematica: "el mar", cantidad: 5 });
    assert.match(sistema, REGLA);
  });
});

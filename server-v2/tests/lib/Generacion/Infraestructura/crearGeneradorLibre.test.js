const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { crearGenerador } = require("../../../../src/lib/Generacion/Infraestructura/http");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const FiltroContenidoJson = require("../../../../src/lib/Juego/Infraestructura/FiltroContenidoJson");
const EmojisPermitidosJson = require("../../../../src/lib/Juego/Infraestructura/EmojisPermitidosJson");

// La composición entrega el filtro y la lista de iconos a los dos generadores: con la temática libre habilitada ya no hay
// fail-closed por configuración faltante.
const dependencias = { filtroContenido: new FiltroContenidoJson(), emojisPermitidos: new EmojisPermitidosJson() };
const GEMINI = { AI_PROVEEDOR: "gemini", GEMINI_API_KEY: "clave-de-prueba", GEMINI_MODELO: "m", AI_MAX_TOKENS_SALIDA: "2000" };
const libre = { habilidad: "contar_silabas", mecanica: "seleccionar_opcion", modoTematica: "libre", tematica: "frutas", cantidad: 5, franjaEdad: 6 };

describe("crearGenerador con las dependencias de la temática libre", () => {
  it("el falso las recibe y genera en modo libre", async () => {
    const g = crearGenerador({ AI_PROVEEDOR: "falso" }, dependencias);
    assert.ok(g instanceof GeneradorContenidoFalso);
    assert.equal((await g.generar(libre)).ejercicios.length, 5);
  });

  it("el generador real las recibe: una solicitud libre llega al proveedor (simulado) y no falla por configuración", async () => {
    const original = globalThis.fetch;
    const falso = new GeneradorContenidoFalso(dependencias);
    const candidatas = falso.candidatas(libre);
    let llamadas = 0;
    globalThis.fetch = async () => {
      llamadas += 1;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ candidatas }) }] }, finishReason: "STOP" }] }) };
    };
    try {
      const g = crearGenerador(GEMINI, dependencias);
      assert.equal(g.constructor.name, "GeneradorContenidoIA");
      const { ejercicios } = await g.generar(libre);
      assert.equal(llamadas, 1);
      assert.equal(ejercicios.length, 5);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("sin las dependencias, el generador real sigue fallando cerrado ANTES de llamar al proveedor", async () => {
    const original = globalThis.fetch;
    let llamadas = 0;
    globalThis.fetch = async () => { llamadas += 1; throw new Error("no debe llamarse"); };
    try {
      await assert.rejects(crearGenerador(GEMINI).generar(libre), /filtroContenido y emojisPermitidos/);
      assert.equal(llamadas, 0);
    } finally {
      globalThis.fetch = original;
    }
  });
});

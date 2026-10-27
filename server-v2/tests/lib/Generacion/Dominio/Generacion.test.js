const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Generacion = require("../../../../src/lib/Generacion/Dominio/Entidades/Generacion");
const Cuota = require("../../../../src/lib/Generacion/Dominio/Entidades/Cuota");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const gen = {
  docenteId: "d1", canalId: "k1", claveSolicitud: "clave-solicitud-0001",
  parametros: { cursoId: "c1", habilidad: "vocales", mecanica: "seleccionar_opcion", tematica: "animales", cantidad: 5 }
};

describe("Entidad Generacion", () => {
  it("nace pendiente y activa", () => {
    const g = new Generacion(gen);
    assert.equal(g.estado, "pendiente");
    assert.equal(g.estaActiva(), true);
    assert.equal(new Generacion({ ...gen, estado: "completada" }).estaActiva(), false);
  });

  it("deduce la mecánica de la habilidad y no exige informarla", () => {
    const { mecanica, ...sinMecanica } = gen.parametros;
    const g = new Generacion({ ...gen, parametros: sinMecanica });
    assert.equal(g.mecanica, "seleccionar_opcion");
    assert.equal(g.parametros.mecanica, undefined);
    assert.equal(new Generacion({ ...gen, parametros: { ...sinMecanica, habilidad: "palabras_silabas" } }).mecanica, "ordenar_silabas");
  });

  it("rechaza datos inválidos", () => {
    const p = gen.parametros;
    for (const malo of [
      { ...gen, claveSolicitud: "corta" },
      { ...gen, claveSolicitud: "x".repeat(65) },
      { ...gen, parametros: undefined },
      { ...gen, parametros: { ...p, mecanica: "ordenar_silabas" } }, // incompatible con la habilidad
      { ...gen, parametros: { ...p, tematica: "cine" } },
      { ...gen, parametros: { ...p, cantidad: 7 } },
      { ...gen, parametros: { ...p, instruccion: "x".repeat(501) } },
      { ...gen, parametros: { ...p, instruccion: "escribe a a@b.com" } },
      { ...gen, parametros: { ...p, instruccion: "<script>" } },
      { ...gen, estado: "otro" },
      { ...gen, tokensEntrada: -1 },
      { ...gen, docenteId: undefined }
    ]) {
      assert.throws(() => new Generacion(malo), EntradaInvalida);
    }
  });
});

describe("Entidad Cuota", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";

  it("acepta contadores de docente y global y calcula lo disponible", () => {
    const c = new Cuota({ docenteId: id, periodo: "2026-10-21", reservado: 1, consumido: 1 });
    assert.equal(c.disponible(3), 1);
    assert.equal(c.disponible(1), 0);
    assert.equal(c.esGlobal(), false);
    assert.equal(new Cuota({ periodo: "2026-10" }).esGlobal(), true);
  });

  it("rechaza periodo y montos inválidos", () => {
    for (const malo of [
      { periodo: "2026-1" },
      { periodo: "otro" },
      { periodo: "2026-10", reservado: -1 },
      { periodo: "2026-10", consumido: "x" }
    ]) {
      assert.throws(() => new Cuota(malo), EntradaInvalida);
    }
  });
});

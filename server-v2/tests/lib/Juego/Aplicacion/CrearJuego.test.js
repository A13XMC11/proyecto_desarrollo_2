const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const CrearJuego = require("../../../../src/lib/Juego/Aplicacion/CrearJuego");
const NoEncontrado = require("../../../../src/lib/Compartido/Dominio/Errores/NoEncontrado");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

// Repositorios falsos que implementan los Ports de Juego y de Aula
const DOCENTE = "11111111-1111-4111-8111-111111111111";
const CURSO = "22222222-2222-4222-8222-222222222222";
const ESTUDIANTE = "33333333-3333-4333-8333-333333333333";
const cursos = { findById: async (id, docenteId) => (id === CURSO && docenteId === DOCENTE ? { id: CURSO } : null) };
const estudiantes = {
  findById: async (id, docenteId) => (docenteId === DOCENTE && id === ESTUDIANTE ? { id, cursoId: CURSO } : id === "otro" ? { id, cursoId: "ajeno" } : null)
};
const crear = () => {
  const guardados = [];
  const juegos = { save: async (j) => { guardados.push(j); return { ...j, id: "abc" }; } };
  return { guardados, caso: new CrearJuego(juegos, cursos, estudiantes) };
};
const datos = { cursoId: CURSO, titulo: "Las vocales", habilidad: "vocales" };

describe("Caso de uso CrearJuego", () => {
  it("crea un juego manual y deduce la mecánica de la habilidad", async () => {
    const { caso, guardados } = crear();
    const juego = await caso.ejecutar(DOCENTE, { ...datos, estudianteId: ESTUDIANTE });
    assert.equal(juego.mecanica, "seleccionar_opcion");
    assert.equal(guardados[0].origen, "manual");
    assert.equal(guardados[0].estado, "borrador");
  });

  it("exige que el curso exista y sea del docente (no hay clave foránea entre motores)", async () => {
    const { caso, guardados } = crear();
    await assert.rejects(caso.ejecutar("00000000-0000-4000-8000-000000000000", datos), NoEncontrado);
    await assert.rejects(caso.ejecutar(DOCENTE, { ...datos, cursoId: "44444444-4444-4444-8444-444444444444" }), NoEncontrado);
    assert.equal(guardados.length, 0);
  });

  it("exige que el estudiante exista y pertenezca al curso", async () => {
    const { caso } = crear();
    await assert.rejects(caso.ejecutar(DOCENTE, { ...datos, estudianteId: "inexistente" }), NoEncontrado);
    await assert.rejects(caso.ejecutar(DOCENTE, { ...datos, estudianteId: "otro" }), EntradaInvalida);
  });

  it("rechaza datos inválidos del juego", async () => {
    const { caso } = crear();
    await assert.rejects(caso.ejecutar(DOCENTE, { ...datos, titulo: "x" }), EntradaInvalida);
    await assert.rejects(caso.ejecutar(DOCENTE, { ...datos, habilidad: "otra" }), EntradaInvalida);
  });
});

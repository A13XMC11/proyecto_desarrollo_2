const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Curso = require("../../../../src/lib/Aula/Dominio/Entidades/Curso");
const Estudiante = require("../../../../src/lib/Aula/Dominio/Entidades/Estudiante");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const curso = { docenteId: "d1", grado: "1.º EGB", paralelo: "a", anioLectivo: "2026-2027" };
const est = { cursoId: "c1", codigoLista: "a01", franjaEdad: 6, avatarId: "gato" };

describe("Entidad Curso", () => {
  it("normaliza el paralelo y por defecto no está archivado", () => {
    const c = new Curso(curso);
    assert.equal(c.paralelo, "A");
    assert.equal(c.archivado, false);
  });

  it("rechaza grado, paralelo y año lectivo inválidos", () => {
    for (const malo of [
      { ...curso, grado: "4.º EGB" },
      { ...curso, paralelo: "AB" },
      { ...curso, paralelo: "1" },
      { ...curso, anioLectivo: "2026" },
      { ...curso, anioLectivo: "2026-2028" },
      { ...curso, docenteId: undefined },
      { ...curso, archivado: "no" }
    ]) {
      assert.throws(() => new Curso(malo), EntradaInvalida);
    }
  });
});

describe("Entidad Estudiante", () => {
  it("normaliza el código a mayúsculas y copia los intereses", () => {
    const intereses = ["animales"];
    const e = new Estudiante({ ...est, intereses });
    assert.equal(e.codigoLista, "A01");
    assert.notEqual(e.intereses, intereses);
  });

  it("valida código de lista", () => {
    for (const codigo of ["", "ABCDEFG", "A-1", "a b", undefined]) {
      assert.throws(() => new Estudiante({ ...est, codigoLista: codigo }), EntradaInvalida);
    }
    assert.equal(new Estudiante({ ...est, codigoLista: "123456" }).codigoLista, "123456");
  });

  it("valida el apodo: máx 20 caracteres, 2 palabras, texto plano", () => {
    assert.equal(new Estudiante({ ...est, apodo: "Pepito Luz" }).apodo, "Pepito Luz");
    for (const apodo of ["x".repeat(21), "uno dos tres", "<b>x", "a@b.c", "http://x"]) {
      assert.throws(() => new Estudiante({ ...est, apodo }), EntradaInvalida);
    }
  });

  it("valida franja de edad, intereses y avatar", () => {
    assert.throws(() => new Estudiante({ ...est, franjaEdad: 8 }), EntradaInvalida);
    assert.throws(() => new Estudiante({ ...est, avatarId: undefined }), EntradaInvalida);
    assert.throws(() => new Estudiante({ ...est, intereses: ["musica"] }), EntradaInvalida);
    assert.throws(() => new Estudiante({ ...est, intereses: ["animales", "animales"] }), EntradaInvalida);
    assert.throws(
      () => new Estudiante({ ...est, intereses: ["animales", "naturaleza", "objetos_cotidianos", "animales", "naturaleza", "animales"] }),
      EntradaInvalida
    );
  });
});

const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID: uuid } = require("node:crypto");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const { crearDocente, crearCurso } = require("../../../Infraestructura/database/fixturesSql");
const ConflictoDeEstado = require("../../../../src/lib/Compartido/Dominio/Errores/ConflictoDeEstado");
const Curso = require("../../../../src/lib/Aula/Dominio/Entidades/Curso");
const Estudiante = require("../../../../src/lib/Aula/Dominio/Entidades/Estudiante");
const CursoRepo = require("../../../../src/lib/Aula/Infraestructura/CursoRepositorySequelize");
const EstudianteRepo = require("../../../../src/lib/Aula/Infraestructura/EstudianteRepositorySequelize");

const prueba = pruebasConBase("AulaRepository", { sql: true, mongo: false });
const cursos = new CursoRepo();
const estudiantes = new EstudianteRepo();
const curso = (docenteId, extra = {}) => new Curso({ docenteId, grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027", ...extra });
const est = (cursoId, codigoLista, extra = {}) =>
  new Estudiante({ cursoId, codigoLista, franjaEdad: 6, avatarId: "gato", ...extra });

describe("CursoRepositorySequelize", () => {
  prueba("guarda, lee y filtra por docente", async () => {
    const a = (await crearDocente()).id;
    const b = (await crearDocente()).id;
    const c = await cursos.save(curso(a));
    assert.ok(c instanceof Curso);
    assert.equal((await cursos.findById(c.id, a)).paralelo, "A");
    assert.equal(await cursos.findById(c.id, b), null, "otro docente no lo ve");
    assert.equal(await cursos.findById("x", a), null);
    assert.deepEqual(await cursos.findAllByDocente(b), []);
    assert.equal((await cursos.findAllByDocente(a)).length, 1);
  });

  prueba("un curso exige un docente existente (clave foránea)", async () => {
    await assert.rejects(cursos.save(curso(uuid())), (e) => e.name === "SequelizeForeignKeyConstraintError");
  });

  prueba("duplicado -> ConflictoDeEstado; en paralelo solo uno se guarda", async () => {
    const d = (await crearDocente()).id;
    await cursos.save(curso(d));
    await assert.rejects(cursos.save(curso(d)), (e) => e instanceof ConflictoDeEstado && e.codigo === "CURSO_DUPLICADO");
    const e = (await crearDocente()).id;
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => cursos.save(curso(e))));
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  });

  prueba("update con lista blanca, archivado y conteo de activos", async () => {
    const d = (await crearDocente()).id;
    const otro = (await crearDocente()).id;
    const c = await cursos.save(curso(d));
    await cursos.save(curso(d, { paralelo: "B" }));
    assert.equal(await cursos.contarActivos(d), 2);
    const archivado = await cursos.update(c.id, d, { archivado: true, docenteId: otro });
    assert.equal(archivado.archivado, true);
    assert.equal(archivado.docenteId, d);
    assert.equal(await cursos.contarActivos(d), 1);
    assert.equal((await cursos.findAllByDocente(d, { archivado: true })).length, 1);
    assert.equal((await cursos.findAllByDocente(d, { archivado: false })).length, 1);
    assert.equal(await cursos.update(c.id, otro, { archivado: false }), null, "no edita cursos ajenos");
    await assert.rejects(cursos.update(c.id, d, { paralelo: "B" }), ConflictoDeEstado);
    await assert.rejects(cursos.update(c.id, d, { grado: "9.º" }));
  });
});

describe("EstudianteRepositorySequelize", () => {
  prueba("guarda, lee y respeta al docente dueño del curso", async () => {
    const d = (await crearDocente()).id;
    const c = (await crearCurso(d)).id;
    const e = await estudiantes.save(est(c, "a01", { apodo: "Luz", intereses: ["objetos_cotidianos", "animales"] }));
    assert.ok(e instanceof Estudiante);
    assert.equal(e.codigoLista, "A01");
    assert.equal(e.docenteId, undefined, "el estudiante no guarda docente: es el del curso");
    assert.deepEqual(e.intereses, ["animales", "objetos_cotidianos"], "los intereses viven en su tabla");
    assert.equal((await estudiantes.findById(e.id, d)).apodo, "Luz");
    assert.equal(await estudiantes.findById(e.id, uuid()), null, "otro docente no lo ve");
    assert.deepEqual(await estudiantes.findByCurso(c, uuid()), []);
    const lista = await estudiantes.findByCurso(c, d);
    assert.equal(lista.length, 1);
    assert.deepEqual(lista[0].intereses, ["animales", "objetos_cotidianos"]);
  });

  prueba("el curso debe existir (clave foránea)", async () => {
    await assert.rejects(estudiantes.save(est(uuid(), "Z2")), (e) => e.name === "SequelizeForeignKeyConstraintError");
  });

  prueba("código duplicado en el curso (incluso archivado) -> ConflictoDeEstado", async () => {
    const d = (await crearDocente()).id;
    const c = (await crearCurso(d)).id;
    await estudiantes.save(est(c, "X1", { archivado: true }));
    await assert.rejects(
      estudiantes.save(est(c, "x1")),
      (e) => e instanceof ConflictoDeEstado && e.codigo === "CODIGO_LISTA_DUPLICADO"
    );
    const otroCurso = (await crearCurso(d, { paralelo: "B" })).id;
    await estudiantes.save(est(otroCurso, "X1"));
  });

  prueba("update con lista blanca (cursoId no cambia), apodo nulo, intereses y conteo", async () => {
    const d = (await crearDocente()).id;
    const c = (await crearCurso(d)).id;
    const e = await estudiantes.save(est(c, "B1", { apodo: "Sol", intereses: ["animales"] }));
    await estudiantes.save(est(c, "B2"));
    const nuevoCurso = (await crearCurso(d, { paralelo: "C" })).id;
    const u = await estudiantes.update(e.id, d, {
      apodo: null, franjaEdad: 7, cursoId: nuevoCurso, archivado: true, intereses: ["naturaleza", "naturaleza"]
    });
    assert.equal(u.apodo, undefined);
    assert.equal(u.franjaEdad, 7);
    assert.equal(u.cursoId, c);
    assert.deepEqual(u.intereses, ["naturaleza"], "reemplaza los intereses sin repetirlos");
    assert.equal(await estudiantes.contarActivosPorCurso(c, d), 1);
    assert.equal(await estudiantes.contarActivosPorCurso(c, uuid()), 0);
    assert.equal(await estudiantes.update(e.id, uuid(), { franjaEdad: 5 }), null, "no edita estudiantes ajenos");
    await assert.rejects(estudiantes.update(e.id, d, { franjaEdad: 9 }));
    await assert.rejects(estudiantes.update(e.id, d, { codigoLista: "B2" }), ConflictoDeEstado);
  });

  prueba("no se puede borrar un curso con estudiantes (RESTRICT)", async () => {
    const d = (await crearDocente()).id;
    const c = (await crearCurso(d)).id;
    await estudiantes.save(est(c, "R1"));
    const { obtenerSequelize } = require("../../../../src/Infraestructura/database/Sequelize");
    await assert.rejects(
      obtenerSequelize().query("DELETE FROM cursos WHERE id = :c", { replacements: { c } }),
      (error) => error.parent?.code === "23503"
    );
  });
});

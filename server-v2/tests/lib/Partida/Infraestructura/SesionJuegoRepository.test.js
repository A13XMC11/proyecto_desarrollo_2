const { describe } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const ConflictoDeEstado = require("../../../../src/lib/Compartido/Dominio/Errores/ConflictoDeEstado");
const SesionJuego = require("../../../../src/lib/Partida/Dominio/Entidades/SesionJuego");
const Intento = require("../../../../src/lib/Partida/Dominio/Entidades/Intento");
const Pista = require("../../../../src/lib/Partida/Dominio/Entidades/Pista");
const Repo = require("../../../../src/lib/Partida/Infraestructura/SesionJuegoRepositoryMongoose");

const { randomUUID: uuid } = require("node:crypto");
const oid = () => new mongoose.Types.ObjectId().toString();
const prueba = pruebasConBase("SesionJuegoRepository");
const repo = new Repo();

const sesion = (extra = {}) =>
  new SesionJuego({
    docenteId: uuid(), cursoId: uuid(), estudianteId: uuid(), juegoId: oid(), versionId: oid(),
    canalInicioId: oid(), semilla: 42, ...extra
  });
const intento = (operacionId, extra = {}) =>
  new Intento({ ejercicioId: "e1", numeroIntento: 1, eleccion: "a", esCorrecto: true, operacionId, ...extra });

describe("SesionJuegoRepositoryMongoose: lectura y escritura", () => {
  prueba("guarda, lee y aísla por docente", async () => {
    const s = await repo.save(sesion());
    assert.ok(s instanceof SesionJuego);
    assert.equal(s.estado, "en_curso");
    assert.equal(s.semilla, 42);
    assert.equal((await repo.findById(s.id, s.docenteId)).id, s.id);
    assert.equal(await repo.findById(s.id, uuid()), null);
    assert.equal((await repo.findEnCurso(s.estudianteId, s.juegoId, s.docenteId)).id, s.id);
    assert.equal(await repo.findEnCurso(s.estudianteId, s.juegoId, uuid()), null);
  });

  prueba("segunda partida en curso -> ConflictoDeEstado (también en paralelo)", async () => {
    const base = sesion();
    await repo.save(base);
    await assert.rejects(
      repo.save(new SesionJuego({ ...base, id: undefined })),
      (e) => e instanceof ConflictoDeEstado && e.codigo === "PARTIDA_EN_CURSO_EXISTENTE"
    );
    const otro = sesion();
    const r = await Promise.allSettled(Array.from({ length: 6 }, () => repo.save(new SesionJuego({ ...otro }))));
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  });
});

describe("SesionJuegoRepositoryMongoose: operaciones idempotentes", () => {
  prueba("registrarIntento cuenta una vez cada operacionId", async () => {
    const s = await repo.save(sesion());
    const a = await repo.registrarIntento(s.id, s.docenteId, intento("op-1"));
    assert.equal(a.registrado, true);
    assert.equal(a.sesion.intentos.length, 1);
    assert.ok(a.sesion.intentos[0] instanceof Intento);
    const repetido = await repo.registrarIntento(s.id, s.docenteId, intento("op-1", { eleccion: "z" }));
    assert.equal(repetido.registrado, false);
    assert.equal(repetido.sesion.intentos.length, 1);
    assert.equal(repetido.sesion.intentos[0].eleccion, "a", "no se sobrescribe el intento original");
    const b = await repo.registrarIntento(s.id, s.docenteId, intento("op-2", { numeroIntento: 2, eleccion: ["p1", "p2"] }));
    assert.equal(b.sesion.intentos.length, 2);
    assert.deepEqual(b.sesion.intentos[1].eleccion, ["p1", "p2"]);
  });

  prueba("el mismo operacionId en paralelo cuenta una sola vez", async () => {
    const s = await repo.save(sesion());
    const r = await Promise.all(Array.from({ length: 12 }, () => repo.registrarIntento(s.id, s.docenteId, intento("op-par"))));
    assert.equal(r.filter((x) => x.registrado).length, 1);
    assert.equal((await repo.findById(s.id, s.docenteId)).intentos.length, 1);
  });

  prueba("operaciones distintas en paralelo se cuentan todas", async () => {
    const s = await repo.save(sesion());
    await Promise.all(Array.from({ length: 10 }, (_, i) => repo.registrarIntento(s.id, s.docenteId, intento(`op-${i}`))));
    assert.equal((await repo.findById(s.id, s.docenteId)).intentos.length, 10);
  });

  prueba("registrarPista es idempotente por operacionId", async () => {
    const s = await repo.save(sesion());
    const r = await Promise.all(
      Array.from({ length: 8 }, () => repo.registrarPista(s.id, s.docenteId, new Pista({ ejercicioId: "e1", operacionId: "pista-1" })))
    );
    assert.equal(r.filter((x) => x.registrado).length, 1);
    const actual = await repo.findById(s.id, s.docenteId);
    assert.equal(actual.pistas.length, 1);
    assert.ok(actual.pistas[0] instanceof Pista);
  });

  prueba("no registra en partidas ajenas, inexistentes o cerradas", async () => {
    const s = await repo.save(sesion());
    const ajeno = await repo.registrarIntento(s.id, uuid(), intento("op-x"));
    assert.deepEqual([ajeno.registrado, ajeno.sesion], [false, null]);
    assert.deepEqual((await repo.registrarIntento(oid(), s.docenteId, intento("op-x"))).sesion, null);
    assert.equal((await repo.registrarIntento("mal", s.docenteId, intento("op-x"))).registrado, false);

    await repo.finalizar(s.id, s.docenteId);
    const cerrada = await repo.registrarIntento(s.id, s.docenteId, intento("op-tarde"));
    assert.equal(cerrada.registrado, false);
    assert.equal(cerrada.sesion.estado, "finalizada");
    assert.equal(cerrada.sesion.intentos.length, 0);
    assert.equal((await repo.registrarPista(s.id, s.docenteId, new Pista({ ejercicioId: "e1", operacionId: "p" }))).registrado, false);
  });
});

describe("SesionJuegoRepositoryMongoose: estados y consultas", () => {
  prueba("finalizar y abandonar son condicionales desde en_curso (carrera: gana uno)", async () => {
    const s = await repo.save(sesion());
    const r = await Promise.all([
      repo.finalizar(s.id, s.docenteId), repo.abandonar(s.id, s.docenteId),
      repo.finalizar(s.id, s.docenteId), repo.abandonar(s.id, s.docenteId)
    ]);
    assert.equal(r.filter(Boolean).length, 1);
    const final = await repo.findById(s.id, s.docenteId);
    assert.ok(["finalizada", "abandonada"].includes(final.estado));
    assert.ok(final.finalizadaEn);
    assert.equal(await repo.finalizar(s.id, s.docenteId), null);
    assert.equal(await repo.abandonar(s.id, uuid()), null);
    assert.equal(await repo.findEnCurso(s.estudianteId, s.juegoId, s.docenteId), null);
    await repo.save(new SesionJuego({ ...s, id: undefined, estado: "en_curso" }));
  });

  prueba("actualizarEjercicioActual es monótono y solo en curso", async () => {
    const s = await repo.save(sesion());
    assert.equal((await repo.actualizarEjercicioActual(s.id, s.docenteId, 3)).ejercicioActual, 3);
    assert.equal((await repo.actualizarEjercicioActual(s.id, s.docenteId, 1)).ejercicioActual, 3, "no retrocede");
    assert.equal(await repo.actualizarEjercicioActual(s.id, s.docenteId, -1), null);
    assert.equal(await repo.actualizarEjercicioActual(s.id, uuid(), 4), null);
    await repo.abandonar(s.id, s.docenteId);
    assert.equal(await repo.actualizarEjercicioActual(s.id, s.docenteId, 4), null);
  });

  prueba("findByFiltros filtra por curso, estudiante, estado, fechas y habilidad (vía versión)", async () => {
    const d = uuid();
    const curso = uuid();
    const estudiante = uuid();
    const vocales = new mongoose.Types.ObjectId();
    const silabas = new mongoose.Types.ObjectId();
    const col = mongoose.connection.db.collection("versionesJuego");
    const cfg = (habilidad) => ({ habilidad });
    await col.insertMany([{ _id: vocales, juegoId: new mongoose.Types.ObjectId(), numero: 1, configuracion: cfg("vocales") }, { _id: silabas, juegoId: new mongoose.Types.ObjectId(), numero: 1, configuracion: cfg("palabras_silabas") }], { bypassDocumentValidation: true });

    const a = await repo.save(sesion({ docenteId: d, cursoId: curso, estudianteId: estudiante, versionId: vocales.toString() }));
    const b = await repo.save(sesion({ docenteId: d, cursoId: curso, versionId: silabas.toString() }));
    await repo.save(sesion({ docenteId: uuid(), cursoId: curso, versionId: vocales.toString() }));
    await repo.finalizar(b.id, d);

    const ids = async (f) => (await repo.findByFiltros(d, f)).map((s) => s.id).sort();
    assert.deepEqual(await ids({}), [a.id, b.id].sort());
    assert.deepEqual(await ids({ cursoId: curso, estudianteId: estudiante }), [a.id]);
    assert.deepEqual(await ids({ habilidad: "vocales" }), [a.id]);
    assert.deepEqual(await ids({ habilidad: "palabras_silabas" }), [b.id]);
    assert.deepEqual(await ids({ habilidad: "inexistente" }), []);
    assert.deepEqual(await ids({ estado: "finalizada" }), [b.id]);
    assert.deepEqual(await ids({ desde: new Date(Date.now() + 60000) }), []);
    assert.deepEqual(await ids({ hasta: new Date(Date.now() + 60000), desde: new Date(Date.now() - 60000) }), [a.id, b.id].sort());
    assert.deepEqual(await ids({ cursoId: "mal" }), []);
    assert.deepEqual(await repo.findByFiltros(uuid(), {}), []);
    assert.ok((await repo.findByFiltros(d, {}))[0] instanceof SesionJuego);
  });

  prueba("listarRecientes y listarEnCurso: orden, límite y docente", async () => {
    const d = uuid();
    const creadas = [];
    for (let i = 0; i < 4; i += 1) creadas.push(await repo.save(sesion({ docenteId: d })));
    await repo.finalizar(creadas[0].id, d);
    await repo.save(sesion());

    const recientes = await repo.listarRecientes(d, 3);
    assert.equal(recientes.length, 3);
    assert.equal(recientes[0].id, creadas[3].id);
    assert.equal((await repo.listarRecientes(d, 1000)).length, 4);
    const enCurso = await repo.listarEnCurso(d);
    assert.equal(enCurso.length, 3);
    assert.ok(enCurso.every((s) => s.estado === "en_curso" && s.docenteId === d));
    assert.deepEqual(await repo.listarRecientes("mal"), []);
  });
});

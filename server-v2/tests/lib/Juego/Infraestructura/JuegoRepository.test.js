const { describe } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const ConflictoDeEstado = require("../../../../src/lib/Compartido/Dominio/Errores/ConflictoDeEstado");
const Juego = require("../../../../src/lib/Juego/Dominio/Entidades/Juego");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const JuegoRepo = require("../../../../src/lib/Juego/Infraestructura/JuegoRepositoryMongoose");
const VersionRepo = require("../../../../src/lib/Juego/Infraestructura/VersionRepositoryMongoose");

const { randomUUID: uuid } = require("node:crypto");
const oid = () => new mongoose.Types.ObjectId().toString();
const prueba = pruebasConBase("JuegoRepository");
const juegos = new JuegoRepo();
const versiones = new VersionRepo();

const juego = (docenteId, extra = {}) =>
  new Juego({
    docenteId, cursoId: uuid(), titulo: "Mi juego", habilidad: "vocales",
    mecanica: "seleccionar_opcion", origen: "manual", ...extra
  });
const ejercicio = (id) => ({
  id, consigna: "¿Con qué vocal empieza?",
  opciones: [{ id: "a", texto: "a" }, { id: "e", texto: "e" }, { id: "i", texto: "i" }], respuestaCorrectaId: "a"
});
const completos = () => ["e1", "e2", "e3", "e4", "e5"].map(ejercicio); // la configuración exige 5
const version = (juegoId, estado = "borrador", extra = {}) =>
  new VersionJuego({
    juegoId, estado, ejercicios: [ejercicio("e1")], aprobadoEn: estado === "aprobada" ? new Date() : undefined,
    configuracion: { habilidad: "vocales", mecanica: "seleccionar_opcion", tematica: "animales", cantidadEjercicios: 5 },
    ...extra
  });

describe("JuegoRepositoryMongoose", () => {
  prueba("guarda, lee y aísla por docente", async () => {
    const d = uuid();
    const j = await juegos.save(juego(d));
    assert.ok(j instanceof Juego);
    assert.equal(j.versionActualId, null);
    assert.equal((await juegos.findById(j.id, d)).titulo, "Mi juego");
    assert.equal(await juegos.findById(j.id, uuid()), null);
    assert.equal(await juegos.update(j.id, uuid(), { titulo: "Hack" }), null);
    assert.equal((await juegos.update(j.id, d, { titulo: "Otro título", estado: "archivado" })).titulo, "Otro título");
    assert.equal((await juegos.findById(j.id, d)).estado, "borrador");
  });

  prueba("generacionId repetido -> ConflictoDeEstado y búsqueda por generación", async () => {
    const d = uuid();
    const g = uuid();
    const j = await juegos.save(juego(d, { origen: "ia", generacionId: g }));
    await assert.rejects(
      juegos.save(juego(d, { origen: "ia", generacionId: g })),
      (e) => e instanceof ConflictoDeEstado && e.codigo === "GENERACION_YA_TIENE_JUEGO"
    );
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => juegos.save(juego(d, { origen: "ia", generacionId: uuid() }))));
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 5);
    assert.equal((await juegos.findByGeneracionId(g, d)).id, j.id);
    assert.equal(await juegos.findByGeneracionId(g, uuid()), null);
  });

  prueba("findPaginado filtra, excluye archivados, limita a 50 y es propio del docente", async () => {
    const d = uuid();
    const curso = uuid();
    for (let i = 0; i < 7; i += 1) await juegos.save(juego(d, { cursoId: curso, titulo: `Juego número ${i}` }));
    await juegos.save(juego(d, { titulo: "Palabras (raras) [x]", habilidad: "palabras_silabas", mecanica: "ordenar_silabas" }));
    const archivado = await juegos.save(juego(d, { titulo: "Archivado uno" }));
    await juegos.archivar(archivado.id, d);
    await juegos.save(juego(uuid(), { titulo: "De otro docente" }));

    const todos = await juegos.findPaginado(d, {}, { limite: 1000 });
    assert.equal(todos.total, 8);
    assert.equal(todos.limite, 50);
    assert.ok(todos.items.every((j) => j.estado !== "archivado"));
    const p1 = await juegos.findPaginado(d, {}, { pagina: 1, limite: 5 });
    const p2 = await juegos.findPaginado(d, {}, { pagina: 2, limite: 5 });
    assert.equal(p1.items.length, 5);
    assert.equal(p2.items.length, 3);
    assert.equal(new Set([...p1.items, ...p2.items].map((j) => j.id)).size, 8);
    assert.equal((await juegos.findPaginado(d, { cursoId: curso })).total, 7);
    assert.equal((await juegos.findPaginado(d, { habilidad: "palabras_silabas" })).total, 1);
    assert.equal((await juegos.findPaginado(d, { texto: "(raras) [x]" })).total, 1, "el texto se escapa");
    assert.equal((await juegos.findPaginado(d, { texto: "NÚMERO" })).total, 7, "sin distinguir mayúsculas");
    assert.equal((await juegos.findPaginado(d, { texto: "número 3" })).total, 1);
    assert.equal((await juegos.findPaginado(d, { estado: "archivado" })).total, 1);
    assert.equal((await juegos.findPaginado(d, { incluirArchivados: true })).total, 9);
    assert.equal((await juegos.findPaginado(d, { cursoId: "mal" })).total, 0);
    assert.equal((await juegos.findPaginado(d, { texto: { $ne: "" } })).total, 8, "un objeto no es un filtro de texto");
  });

  prueba("marcarListoConVersion, archivar y desarchivar son condicionales", async () => {
    const d = uuid();
    const j = await juegos.save(juego(d));
    const v = oid();
    const listo = await juegos.marcarListoConVersion(j.id, d, v);
    assert.equal(listo.estado, "listo");
    assert.equal(listo.versionActualId, v);
    assert.equal(await juegos.marcarListoConVersion(j.id, uuid(), v), null);

    assert.equal((await juegos.archivar(j.id, d)).estado, "archivado");
    assert.equal(await juegos.archivar(j.id, d), null, "ya archivado");
    assert.equal(await juegos.marcarListoConVersion(j.id, d, oid()), null, "un archivado no se modifica");
    assert.equal((await juegos.desarchivar(j.id, d)).estado, "listo");
    assert.equal(await juegos.desarchivar(j.id, d), null);

    const sinVersion = await juegos.save(juego(d));
    await juegos.archivar(sinVersion.id, d);
    assert.equal((await juegos.desarchivar(sinVersion.id, d)).estado, "borrador");
    assert.equal(await juegos.archivar(j.id, uuid()), null);
  });
});

describe("VersionRepositoryMongoose", () => {
  prueba("asigna números correlativos y lee versiones", async () => {
    const j = oid();
    const v1 = await versiones.save(version(j, "descartada"));
    const v2 = await versiones.save(version(j, "borrador"));
    assert.ok(v1 instanceof VersionJuego);
    assert.deepEqual([v1.numero, v2.numero], [1, 2]);
    assert.equal((await versiones.findById(v2.id, j)).ejercicios[0].opciones.length, 3);
    assert.equal(await versiones.findById(v2.id, oid()), null);
    assert.deepEqual((await versiones.findByJuego(j)).map((v) => v.numero), [2, 1]);
    assert.equal((await versiones.findBorradorByJuego(j)).id, v2.id);
  });

  prueba("el número se asigna sin repetidos con escrituras en paralelo", async () => {
    const j = oid();
    const r = await Promise.all(Array.from({ length: 10 }, () => versiones.save(version(j, "descartada"))));
    const numeros = r.map((v) => v.numero).sort((a, b) => a - b);
    assert.deepEqual(numeros, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  prueba("un segundo borrador activo -> ConflictoDeEstado (también en paralelo)", async () => {
    const j = oid();
    await versiones.save(version(j));
    await assert.rejects(
      versiones.save(version(j)),
      (e) => e instanceof ConflictoDeEstado && e.codigo === "BORRADOR_ACTIVO_EXISTENTE"
    );
    const otro = oid();
    const r = await Promise.allSettled(Array.from({ length: 6 }, () => versiones.save(version(otro))));
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.ok(r.filter((x) => x.status === "rejected").every((x) => x.reason instanceof ConflictoDeEstado));
  });

  prueba("aprobar exige la cantidad configurada de ejercicios (atómico)", async () => {
    const j = oid();
    const v = await versiones.save(version(j));
    assert.equal(await versiones.aprobar(v.id, j), null, "1 de 5 ejercicios: incompleta");
    await versiones.actualizarBorrador(v.id, j, { ejercicios: completos() });
    assert.equal((await versiones.aprobar(v.id, j)).estado, "aprobada");
  });

  prueba("aprobar dos veces en paralelo: solo una tiene efecto", async () => {
    const j = oid();
    const v = await versiones.save(version(j, "borrador", { ejercicios: completos() }));
    const r = await Promise.all(Array.from({ length: 8 }, () => versiones.aprobar(v.id, j)));
    assert.equal(r.filter(Boolean).length, 1);
    const aprobada = await versiones.findById(v.id, j);
    assert.equal(aprobada.estado, "aprobada");
    assert.ok(aprobada.aprobadoEn instanceof Date);
    assert.equal(await versiones.aprobar(v.id, j), null);
  });

  prueba("una versión aprobada o descartada nunca se sobrescribe", async () => {
    const j = oid();
    const v = await versiones.save(version(j));
    const editada = await versiones.actualizarBorrador(v.id, j, { ejercicios: completos() });
    assert.equal(editada.ejercicios.length, 5);
    await versiones.aprobar(v.id, j);
    assert.equal(await versiones.actualizarBorrador(v.id, j, { ejercicios: [ejercicio("x")] }), null);
    assert.equal(await versiones.descartar(v.id, j), null);
    const final = await versiones.findById(v.id, j);
    assert.equal(final.estado, "aprobada");
    assert.equal(final.ejercicios.length, 5);

    const d = await versiones.save(version(j));
    assert.equal((await versiones.descartar(d.id, j)).estado, "descartada");
    assert.equal(await versiones.aprobar(d.id, j), null);
    assert.equal(await versiones.descartar(d.id, oid()), null, "juego ajeno");
    assert.equal(await versiones.actualizarBorrador(d.id, j, { ejercicios: "no" }), null);
  });
});

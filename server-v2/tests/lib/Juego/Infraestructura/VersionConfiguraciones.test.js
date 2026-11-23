const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID: uuid } = require("node:crypto");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const Juego = require("../../../../src/lib/Juego/Dominio/Entidades/Juego");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const JuegoRepo = require("../../../../src/lib/Juego/Infraestructura/JuegoRepositoryMongoose");
const VersionRepo = require("../../../../src/lib/Juego/Infraestructura/VersionRepositoryMongoose");
const ListarJuegos = require("../../../../src/lib/Juego/Aplicacion/ListarJuegos");

// La biblioteca necesita saber, por actividad, si es de temática libre (y cuál): se resume desde su versión más reciente
const prueba = pruebasConBase("VersionConfiguraciones");
const juegos = new JuegoRepo();
const versiones = new VersionRepo();

const nuevoJuego = (docenteId = uuid()) => juegos.save(new Juego({
  docenteId, cursoId: uuid(), titulo: "Mi juego", habilidad: "vocales", mecanica: "seleccionar_opcion", origen: "manual"
}));
const ejercicioCatalogo = (id) => ({
  id, consigna: "¿Con qué vocal empieza?", recursoId: "abeja",
  opciones: [{ id: "a", texto: "a" }, { id: "e", texto: "e" }, { id: "i", texto: "i" }], respuestaCorrectaId: "a"
});
const version = (juegoId, config, ejercicios = []) => versiones.save(new VersionJuego({
  juegoId, ejercicios, configuracion: { habilidad: "vocales", mecanica: "seleccionar_opcion", cantidadEjercicios: 5, ...config }
}));

describe("VersionRepositoryMongoose.findConfiguraciones", () => {
  prueba("devuelve el modo y la temática de la versión más reciente de cada actividad", async () => {
    const a = await nuevoJuego();
    const b = await nuevoJuego();
    const sinVersiones = await nuevoJuego();
    await version(a.id, { modoTematica: "libre", tematica: "frutas" });
    await version(b.id, { tematica: "animales" });
    const r = await versiones.findConfiguraciones([a.id, b.id, sinVersiones.id]);
    assert.deepEqual(r.get(a.id), { modoTematica: "libre", tematica: "frutas" });
    assert.deepEqual(r.get(b.id), { modoTematica: "catalogo", tematica: "animales" });
    assert.equal(r.has(sinVersiones.id), false);
  });

  prueba("usa la versión más nueva que no esté descartada", async () => {
    const j = await nuevoJuego();
    const v1 = await version(j.id, { tematica: "animales" }, ["e1", "e2", "e3", "e4", "e5"].map(ejercicioCatalogo));
    await versiones.aprobar(v1.id, j.id);
    const v2 = await version(j.id, { modoTematica: "libre", tematica: "colores" });
    assert.deepEqual((await versiones.findConfiguraciones([j.id])).get(j.id), { modoTematica: "libre", tematica: "colores" });
    await versiones.descartar(v2.id, j.id);
    assert.deepEqual((await versiones.findConfiguraciones([j.id])).get(j.id), { modoTematica: "catalogo", tematica: "animales" });
  });

  prueba("ignora ids que no son válidos y una lista vacía", async () => {
    assert.equal((await versiones.findConfiguraciones([])).size, 0);
    assert.equal((await versiones.findConfiguraciones(["no-es-un-id", undefined, null, { $ne: 1 }])).size, 0);
  });
});

describe("ListarJuegos con la temática de cada actividad", () => {
  prueba("cada actividad de la página trae su configuración; las de catálogo y las vacías no se rompen", async () => {
    const docente = uuid();
    const libre = await nuevoJuego(docente);
    const catalogo = await nuevoJuego(docente);
    const vacio = await nuevoJuego(docente);
    await version(libre.id, { modoTematica: "libre", tematica: "sonidos de animales" });
    await version(catalogo.id, { tematica: "escuela" });
    const { items, total } = await new ListarJuegos(juegos, versiones).ejecutar(docente, {}, {});
    assert.equal(total, 3);
    const por = new Map(items.map((i) => [i.id, i]));
    assert.deepEqual(por.get(libre.id).configuracion, { modoTematica: "libre", tematica: "sonidos de animales" });
    assert.deepEqual(por.get(catalogo.id).configuracion, { modoTematica: "catalogo", tematica: "escuela" });
    assert.equal(por.get(vacio.id).configuracion, undefined);
    assert.equal(por.get(libre.id).titulo, "Mi juego", "el resto del juego no cambia");
  });
});

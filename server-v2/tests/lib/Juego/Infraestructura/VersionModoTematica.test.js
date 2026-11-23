const { describe } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { randomUUID: uuid } = require("node:crypto");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const Juego = require("../../../../src/lib/Juego/Dominio/Entidades/Juego");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const JuegoRepo = require("../../../../src/lib/Juego/Infraestructura/JuegoRepositoryMongoose");
const VersionRepo = require("../../../../src/lib/Juego/Infraestructura/VersionRepositoryMongoose");
const VersionJuegoModel = require("../../../../src/lib/Juego/Infraestructura/VersionJuegoModel");

const prueba = pruebasConBase("VersionModoTematica");
const juegos = new JuegoRepo();
const versiones = new VersionRepo();

const nuevoJuego = () => juegos.save(new Juego({
  docenteId: uuid(), cursoId: uuid(), titulo: "Mi juego", habilidad: "vocales", mecanica: "seleccionar_opcion", origen: "manual"
}));
const ejercicio = (id) => ({
  id, consigna: "¿Con qué vocal empieza?", recursoId: "abeja",
  opciones: [{ id: "a", texto: "a" }, { id: "e", texto: "e" }, { id: "i", texto: "i" }], respuestaCorrectaId: "a"
});
const configuracion = (extra = {}) => ({ habilidad: "vocales", mecanica: "seleccionar_opcion", tematica: "animales", cantidadEjercicios: 5, ...extra });

// Documento tal como lo dejaba la versión anterior: sin modoTematica. Se inserta sin pasar por Mongoose,
// que le pondría el valor por defecto y ocultaría el caso real.
const insertarAntiguo = async (juegoId, numero = 1, estado = "borrador") => {
  const { insertedId } = await VersionJuegoModel.collection.insertOne({
    juegoId: new mongoose.Types.ObjectId(juegoId), numero, formatoVersion: 1,
    configuracion: { habilidad: "vocales", mecanica: "seleccionar_opcion", tematica: "animales", cantidadEjercicios: 5 },
    ejercicios: ["e1", "e2", "e3", "e4", "e5"].map(ejercicio), estado,
    ...(estado === "aprobada" && { aprobadoEn: new Date() }), creadoEn: new Date(), actualizadoEn: new Date()
  });
  return insertedId.toString();
};

describe("VersionRepositoryMongoose: modo de temática y datos antiguos (paso 3)", () => {
  prueba("(b) una versión guardada sin modoTematica se lee como del catálogo", async () => {
    const j = await nuevoJuego();
    const id = await insertarAntiguo(j.id);
    const bruto = await VersionJuegoModel.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    assert.equal("modoTematica" in bruto.configuracion, false, "el documento de prueba no tiene el campo");

    for (const leida of [await versiones.findById(id, j.id), (await versiones.findByJuego(j.id))[0], await versiones.findBorradorByJuego(j.id)]) {
      assert.ok(leida instanceof VersionJuego);
      assert.equal(leida.configuracion.modoTematica, "catalogo");
      assert.equal(leida.configuracion.tematica, "animales");
      assert.equal(leida.ejercicios.length, 5);
    }
    const despues = await VersionJuegoModel.collection.findOne({ _id: bruto._id });
    assert.equal("modoTematica" in despues.configuracion, false, "leer no migra ni escribe el documento");
  });

  prueba("una versión antigua se puede editar, aprobar y leer sin migrar nada", async () => {
    const j = await nuevoJuego();
    const id = await insertarAntiguo(j.id);
    const editada = await versiones.actualizarBorrador(id, j.id, { ejercicios: ["e1", "e2", "e3", "e4", "e5"].map(ejercicio) });
    assert.equal(editada.configuracion.modoTematica, "catalogo");
    const aprobada = await versiones.aprobar(id, j.id);
    assert.equal(aprobada.estado, "aprobada");
    assert.equal(aprobada.configuracion.modoTematica, "catalogo");
    assert.equal(aprobada.configuracion.tematica, "animales");
  });

  prueba("una versión nueva del catálogo guarda modoTematica catalogo", async () => {
    const j = await nuevoJuego();
    const v = await versiones.save(new VersionJuego({ juegoId: j.id, configuracion: configuracion(), ejercicios: [ejercicio("e1")] }));
    assert.equal(v.configuracion.modoTematica, "catalogo");
    const bruto = await VersionJuegoModel.collection.findOne({ _id: new mongoose.Types.ObjectId(v.id) });
    assert.equal(bruto.configuracion.modoTematica, "catalogo");
  });

  prueba("(c) una versión con temática libre se guarda y se lee con su texto", async () => {
    const j = await nuevoJuego();
    const v = await versiones.save(new VersionJuego({
      juegoId: j.id, configuracion: configuracion({ modoTematica: "libre", tematica: "Sonidos de Animales" }), ejercicios: [ejercicio("e1")]
    }));
    assert.equal(v.configuracion.modoTematica, "libre");
    assert.equal(v.configuracion.tematica, "sonidos de animales");
    const releida = await versiones.findById(v.id, j.id);
    assert.deepEqual([releida.configuracion.modoTematica, releida.configuracion.tematica], ["libre", "sonidos de animales"]);
  });

  prueba("el modelo es la última barrera: rechaza textos y modos que no corresponden", async () => {
    const j = await nuevoJuego();
    const base = { juegoId: new mongoose.Types.ObjectId(j.id), numero: 1, ejercicios: [], estado: "borrador" };
    const crear = (config) => VersionJuegoModel.create({ ...base, configuracion: configuracion(config) });
    await assert.rejects(crear({ tematica: "frutas" }), /tematica/i, "catálogo con una temática fuera del enum");
    await assert.rejects(crear({ modoTematica: "libre", tematica: "frutas2" }), /tematica/i, "libre con números");
    await assert.rejects(crear({ modoTematica: "libre", tematica: "ab" }), /tematica/i, "libre demasiado corta");
    await assert.rejects(crear({ modoTematica: "libre", tematica: "a".repeat(41) }), /tematica/i, "libre demasiado larga");
    await assert.rejects(crear({ modoTematica: "otro" }), /modoTematica/i);
    const bien = await crear({ modoTematica: "libre", tematica: "medios de transporte" });
    assert.equal(bien.configuracion.tematica, "medios de transporte");
    await bien.deleteOne();
  });
});

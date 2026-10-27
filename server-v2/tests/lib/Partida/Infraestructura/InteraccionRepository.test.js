const { describe } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { randomUUID: uuid } = require("node:crypto");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const Interaccion = require("../../../../src/lib/Partida/Dominio/Entidades/Interaccion");
const InteraccionRepo = require("../../../../src/lib/Partida/Infraestructura/InteraccionRepositoryMongoose");

const oid = () => new mongoose.Types.ObjectId().toString();
const prueba = pruebasConBase("InteraccionRepository");
const interacciones = new InteraccionRepo();

describe("InteraccionRepositoryMongoose", () => {
  const base = () => ({ sesionId: oid(), docenteId: uuid(), canalId: oid(), tipo: "intento", operacionId: "op-1" });

  prueba("registra, es idempotente y lista por sesión y docente", async () => {
    const datos = base();
    const primera = await interacciones.registrar(new Interaccion(datos));
    assert.equal(primera.esNueva, true);
    assert.ok(primera.interaccion instanceof Interaccion);
    const repetida = await interacciones.registrar(new Interaccion(datos));
    assert.equal(repetida.esNueva, false);
    assert.equal(repetida.interaccion.id, primera.interaccion.id);
    await interacciones.registrar(new Interaccion({ ...datos, tipo: "pista" }));
    assert.equal((await interacciones.findBySesion(datos.sesionId, datos.docenteId)).length, 2);
    assert.deepEqual(await interacciones.findBySesion(datos.sesionId, uuid()), []);
  });

  prueba("la misma operación en paralelo se registra una sola vez", async () => {
    const datos = base();
    const r = await Promise.all(Array.from({ length: 8 }, () => interacciones.registrar(new Interaccion(datos))));
    assert.equal(r.filter((x) => x.esNueva).length, 1);
    assert.equal(new Set(r.map((x) => x.interaccion.id)).size, 1);
    assert.equal((await interacciones.findBySesion(datos.sesionId, datos.docenteId)).length, 1);
  });

  prueba("sin sesión u operación siempre se registra", async () => {
    const d = uuid();
    const datos = { docenteId: d, canalId: oid(), tipo: "consulta_resultados" };
    const a = await interacciones.registrar(new Interaccion(datos));
    const b = await interacciones.registrar(new Interaccion(datos));
    assert.equal(a.esNueva && b.esNueva, true);
    assert.notEqual(a.interaccion.id, b.interaccion.id);
  });
});

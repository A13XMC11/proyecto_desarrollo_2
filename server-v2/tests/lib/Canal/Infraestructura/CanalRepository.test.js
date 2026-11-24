const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const Canal = require("../../../../src/lib/Canal/Dominio/Entidades/Canal");
const CanalRepo = require("../../../../src/lib/Canal/Infraestructura/CanalRepositoryMongoose");

const { CANALES } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");
const prueba = pruebasConBase("CanalRepository");
const CanalModel = require("../../../../src/lib/Canal/Infraestructura/CanalModel");
const canales = new CanalRepo();

describe("CanalRepositoryMongoose", () => {
  prueba("asegurar crea los 4 canales una sola vez y busca por código", async () => {
    assert.equal(await CanalModel.countDocuments(), 0, "code first: las colecciones nacen vacías");
    const creados = [];
    for (const datos of CANALES) creados.push(await canales.asegurar(new Canal(datos)));
    assert.equal(creados.length, 4);
    for (const datos of CANALES) await canales.asegurar(new Canal(datos));
    await Promise.all(CANALES.map((datos) => canales.asegurar(new Canal(datos))));
    const todos = await canales.findAll();
    assert.equal(todos.length, 4);
    assert.ok(todos.every((c) => c instanceof Canal));
    assert.equal((await canales.findByCodigo("aula_tableta")).dispositivo, "tableta");
    assert.equal(await canales.findByCodigo("otro"), null);
    assert.equal(await canales.findByCodigo({ $ne: null }), null);
  });

  prueba("un canal válido que falta se recrea al pedirlo; uno ajeno sigue sin existir", async () => {
    await CanalModel.deleteMany({});
    const recreado = await canales.findByCodigo("aula_computador");
    assert.ok(recreado instanceof Canal);
    assert.equal(recreado.superficie, "aula");
    assert.equal(await canales.findByCodigo("canal_inventado"), null);
    assert.equal(await CanalModel.countDocuments(), 1, "solo se recrea el pedido");
  });

  prueba("findAll repone los canales si la colección quedó incompleta", async () => {
    await CanalModel.deleteMany({});
    await canales.asegurar(new Canal(CANALES[0]));
    const todos = await canales.findAll();
    assert.deepEqual(todos.map((c) => c.codigo).sort(), CANALES.map((c) => c.codigo).sort());
  });
});

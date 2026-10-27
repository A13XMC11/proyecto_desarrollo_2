const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const Canal = require("../../../../src/lib/Canal/Dominio/Entidades/Canal");
const CanalRepo = require("../../../../src/lib/Canal/Infraestructura/CanalRepositoryMongoose");

const { CANALES } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");
const prueba = pruebasConBase("CanalRepository");
const canales = new CanalRepo();

describe("CanalRepositoryMongoose", () => {
  prueba("asegurar crea los 4 canales una sola vez y busca por código", async () => {
    assert.equal((await canales.findAll()).length, 0, "code first: las colecciones nacen vacías");
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
});

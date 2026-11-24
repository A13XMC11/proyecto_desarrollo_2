const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { comprobarSalud } = require("../../../src/Infraestructura/http/salud");

const bien = async () => {};
const mal = async () => {
  throw new Error("caída");
};
const colgada = () => new Promise(() => {});

describe("comprobarSalud", () => {
  it("ok cuando las dos bases responden", async () => {
    assert.deepEqual(await comprobarSalud({ sql: bien, mongo: bien }), { ok: true, bases: { sql: "ok", mongo: "ok" } });
  });

  it("señala cuál base está caída", async () => {
    assert.deepEqual(await comprobarSalud({ sql: bien, mongo: mal }), { ok: false, bases: { sql: "ok", mongo: "caida" } });
    assert.deepEqual(await comprobarSalud({ sql: mal, mongo: bien }), { ok: false, bases: { sql: "caida", mongo: "ok" } });
  });

  it("una base que no contesta cuenta como caída y no cuelga la respuesta", async () => {
    const inicio = Date.now();
    const salud = await comprobarSalud({ sql: bien, mongo: colgada, topeMs: 50 });
    assert.equal(salud.ok, false);
    assert.equal(salud.bases.mongo, "caida");
    assert.ok(Date.now() - inicio < 1000);
  });
});

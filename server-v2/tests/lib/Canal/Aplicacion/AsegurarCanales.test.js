const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const AsegurarCanales = require("../../../../src/lib/Canal/Aplicacion/AsegurarCanales");

describe("Caso de uso AsegurarCanales", () => {
  it("asegura los 4 canales (superficie x dispositivo) a través del puerto", async () => {
    const vistos = [];
    const repo = { asegurar: async (canal) => { vistos.push(canal.codigo); return canal; } };
    const canales = await new AsegurarCanales(repo).ejecutar();
    assert.equal(canales.length, 4);
    assert.deepEqual(vistos.sort(), ["aula_computador", "aula_tableta", "docente_computador", "docente_tableta"]);
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const RedactorRecomendacionIA = require("../../../../src/lib/Partida/Infraestructura/RedactorRecomendacionIA");
const RedactorRecomendacionFalso = require("../../../../src/lib/Partida/Infraestructura/RedactorRecomendacionFalso");
const RecomendacionRepaso = require("../../../../src/lib/Partida/Dominio/Entidades/RecomendacionRepaso");

const ANALISIS = {
  suficiente: true, partidas: 14, respondidos: 70,
  habilidades: [{ habilidad: "contar_silabas", respondidos: 20, falloPrimerIntento: 12, sinResolver: 4, conPista: 3, estudiantes: 6, repasar: true }],
  palabras: [{ habilidad: "contar_silabas", objetivo: "mariposa", respondidos: 6, falloPrimerIntento: 4, sinResolver: 1, conPista: 0, estudiantes: 4, repasar: true }]
};

describe("RedactorRecomendacionIA", () => {
  it("pide al proveedor un JSON con el prompt del análisis y devuelve la propuesta y el consumo", async () => {
    const pedidos = [];
    const cliente = {
      redactarJson: async (prompt, opciones) => {
        pedidos.push({ prompt, opciones });
        return { contenido: { resumen: "R", sugerencias: ["S"] }, uso: { proveedor: "x", modelo: "m", tokensEntrada: 1, tokensSalida: 2 } };
      }
    };
    const senal = new AbortController().signal;
    const r = await new RedactorRecomendacionIA({ cliente }).redactar(ANALISIS, { signal: senal });

    assert.deepEqual(r.propuesta, { resumen: "R", sugerencias: ["S"] });
    assert.equal(r.uso.tokensSalida, 2);
    assert.equal(pedidos[0].opciones.signal, senal);
    assert.match(pedidos[0].prompt.usuario, /12 de 20/);
    assert.deepEqual(Object.keys(pedidos[0].prompt.esquema.properties).sort(), ["resumen", "sugerencias"]);
  });

  it("exige un cliente con redactarJson", () => {
    assert.throws(() => new RedactorRecomendacionIA({}), /redactarJson/);
  });
});

describe("RedactorRecomendacionFalso", () => {
  it("redacta una recomendación válida a partir de las cifras, sin consumo", async () => {
    const { propuesta, uso } = await new RedactorRecomendacionFalso().redactar(ANALISIS);
    const r = new RecomendacionRepaso(propuesta);
    assert.match(r.resumen, /Contar sílabas/);
    assert.match(r.resumen, /12 de 20/);
    assert.ok(r.sugerencias.some((s) => /mariposa/.test(s)));
    assert.deepEqual([uso.tokensEntrada, uso.tokensSalida], [0, 0]);
  });

  it("sin habilidades marcadas, lo dice sin inventar dificultades", async () => {
    const { propuesta } = await new RedactorRecomendacionFalso().redactar({
      ...ANALISIS, habilidades: [{ ...ANALISIS.habilidades[0], repasar: false }], palabras: []
    });
    assert.doesNotThrow(() => new RecomendacionRepaso(propuesta));
    assert.match(propuesta.resumen, /ninguna/i);
  });
});

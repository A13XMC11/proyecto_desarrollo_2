const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const GeneradorContenidoIA = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoIA");
const GeneradorContenidoOpenAI = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoOpenAI");
const ErrorDelGenerador = require("../../../../src/lib/Compartido/Dominio/Errores/ErrorDelGenerador");

const CLAVE = "clave-secreta-de-prueba";
const prompt = { sistema: "reglas", usuario: "datos", esquema: { type: "object", properties: { resumen: { type: "string" }, nota: { type: "string" } }, required: ["resumen"] } };
const falsoFetch = (cuerpo, { ok = true, status = 200 } = {}) => {
  const llamadas = [];
  const fn = async (url, opciones) => { llamadas.push({ url, opciones }); return { ok, status, json: async () => cuerpo }; };
  fn.llamadas = llamadas;
  return fn;
};
const gemini = (fetchFn) => new GeneradorContenidoIA({ apiKey: CLAVE, modelo: "m", maxTokensSalida: 500, fetchFn });
const openai = (fetchFn) => new GeneradorContenidoOpenAI({ apiKey: CLAVE, modelo: "m", maxTokensSalida: 500, fetchFn });
const respGemini = (contenido, extra = {}) => ({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(contenido) }] }, ...extra }],
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40 }
});
const respOpenAI = (contenido, { finish = "stop", refusal = null } = {}) => ({
  choices: [{ message: { role: "assistant", content: JSON.stringify(contenido), refusal }, finish_reason: finish }],
  usage: { prompt_tokens: 100, completion_tokens: 40 }
});
const codigoDe = (promesa) => promesa.then(() => null, (e) => (e instanceof ErrorDelGenerador ? e.codigo : `otro: ${e.message}`));

for (const [nombre, crear, resp] of [["Gemini", gemini, respGemini], ["OpenAI", openai, respOpenAI]]) {
  describe(`redactarJson con ${nombre}`, () => {
    it("hace una sola llamada con el prompt y devuelve el objeto y el consumo", async () => {
      const f = falsoFetch(resp({ resumen: "Hola", nota: "x" }));
      const r = await crear(f).redactarJson(prompt);
      assert.equal(f.llamadas.length, 1);
      assert.deepEqual(r.contenido, { resumen: "Hola", nota: "x" });
      assert.equal(r.uso.tokensEntrada, 100);
      assert.equal(r.uso.tokensSalida, 40);
      assert.match(f.llamadas[0].opciones.body, /reglas/);
      assert.match(f.llamadas[0].opciones.body, /datos/);
    });

    it("una respuesta que no es JSON o no es un objeto se rechaza conservando el consumo", async () => {
      const mala = resp({});
      const texto = (r, t) => { if (r.candidates) r.candidates[0].content.parts[0].text = t; else r.choices[0].message.content = t; return r; };
      for (const t of ["no es json", "[1,2]", "7"]) {
        const f = falsoFetch(texto(structuredClone(mala), t));
        const error = await crear(f).redactarJson(prompt).catch((e) => e);
        assert.ok(error instanceof ErrorDelGenerador, t);
        assert.equal(error.codigo, "GENERADOR_RESPUESTA_INVALIDA");
        assert.equal(error.uso.tokensEntrada, 100, "el consumo ya se hizo");
      }
    });

    it("un error HTTP no revela la clave", async () => {
      const error = await crear(falsoFetch({}, { ok: false, status: 500 })).redactarJson(prompt).catch((e) => e);
      assert.equal(error.codigo, "GENERADOR_ERROR");
      assert.doesNotMatch(error.message, new RegExp(CLAVE));
    });
  });
}

describe("redactarJson: bloqueos y respuestas cortadas", () => {
  it("Gemini: una respuesta cortada no sirve", async () => {
    assert.equal(await codigoDe(gemini(falsoFetch(respGemini({ resumen: "x" }, { finishReason: "MAX_TOKENS" }))).redactarJson(prompt)), "GENERADOR_RESPUESTA_INCOMPLETA");
  });
  it("OpenAI: un rechazo o una respuesta cortada no sirven", async () => {
    assert.equal(await codigoDe(openai(falsoFetch(respOpenAI({}, { finish: "length" }))).redactarJson(prompt)), "GENERADOR_RESPUESTA_INCOMPLETA");
    assert.equal(await codigoDe(openai(falsoFetch(respOpenAI({}, { refusal: "no puedo" }))).redactarJson(prompt)), "GENERADOR_BLOQUEADO");
  });
  it("OpenAI quita los null que el modo estricto pone en lo opcional", async () => {
    const r = await openai(falsoFetch(respOpenAI({ resumen: "Hola", nota: null }))).redactarJson(prompt);
    assert.deepEqual(r.contenido, { resumen: "Hola" });
  });
  it("respeta la señal de cancelación", async () => {
    const control = new AbortController();
    control.abort();
    const f = async (url, o) => { if (o.signal?.aborted) throw new Error("abortado"); return { ok: true, json: async () => ({}) }; };
    assert.equal(await codigoDe(gemini(f).redactarJson(prompt, { signal: control.signal })), "GENERADOR_TIEMPO_AGOTADO");
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const GeneradorContenidoOpenAI = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoOpenAI");
const GeneradorContenidoIA = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoIA");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const CatalogoRecursosJson = require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const ErrorDelGenerador = require("../../../../src/lib/Compartido/Dominio/Errores/ErrorDelGenerador");
const { COMPATIBILIDAD } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");
const { crearGenerador } = require("../../../../src/lib/Generacion/Infraestructura/http");

const catalogo = new CatalogoRecursosJson();
const CLAVE = "sk-clave-secreta-de-prueba";
const solicitud = (habilidad, extra = {}) => ({
  habilidad, mecanica: COMPATIBILIDAD[habilidad], tematica: "animales", cantidad: 5,
  recursos: catalogo.listar({ tematica: "animales" }), ...extra
});
const respuestaOpenAI = (contenido, { finish = "stop", usage, message } = {}) => ({
  choices: [{ message: message || { role: "assistant", content: JSON.stringify(contenido), refusal: null }, finish_reason: finish }],
  usage: usage === undefined ? { prompt_tokens: 400, completion_tokens: 200, completion_tokens_details: { reasoning_tokens: 50 } } : usage
});
const falsoFetch = (cuerpo, { ok = true, status = 200 } = {}) => {
  const llamadas = [];
  const fn = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return { ok, status, json: async () => cuerpo };
  };
  fn.llamadas = llamadas;
  return fn;
};
const generadorCon = (fetchFn, extra = {}) => new GeneradorContenidoOpenAI({ apiKey: CLAVE, modelo: "modelo-x", maxTokensSalida: 2000, fetchFn, ...extra });

const VOCAL_DE = { abeja: "a", elefante: "e", iguana: "i", oso: "o", urraca: "u" };
const OTRAS = { a: ["e", "o"], e: ["u", "i"], i: ["a", "o"], o: ["a", "i"], u: ["e", "a"] };
const PALABRAS = Object.keys(VOCAL_DE);
const propuestaVocales = (conNulos = false) => ({
  titulo: "Vocales con animales",
  ejercicios: PALABRAS.map((recursoId, i) => ({
    recursoId, consigna: "¿Con qué vocal empieza?", pista: i === 0 ? "Escucha el primer sonido" : conNulos ? null : undefined,
    vocalesOpciones: [VOCAL_DE[recursoId], ...OTRAS[VOCAL_DE[recursoId]]]
  }))
});
const validar = (habilidad, ejercicios) => {
  VersionJuego.rechazarCamposDesconocidos(ejercicios);
  new VersionJuego({
    juegoId: "j1", ejercicios,
    configuracion: { habilidad, mecanica: COMPATIBILIDAD[habilidad], tematica: "animales", cantidadEjercicios: 5 }
  }).validarContenido(catalogo);
};
const codigoDe = (promesa) => promesa.then(() => null, (e) => (e instanceof ErrorDelGenerador ? e.codigo : `otro: ${e.message}`));

describe("GeneradorContenidoOpenAI: la petición", () => {
  it("llama a Chat Completions con la clave en Authorization y el esquema estricto", async () => {
    const f = falsoFetch(respuestaOpenAI(propuestaVocales()));
    await generadorCon(f).generar(solicitud("vocales"));
    assert.equal(f.llamadas.length, 1, "una sola llamada, sin reintentos");
    const { url, opciones } = f.llamadas[0];
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    assert.equal(opciones.method, "POST");
    assert.equal(opciones.headers.authorization, `Bearer ${CLAVE}`);
    const cuerpo = JSON.parse(opciones.body);
    assert.equal(cuerpo.model, "modelo-x");
    assert.equal(cuerpo.max_completion_tokens, 2000);
    assert.equal(cuerpo.max_tokens, undefined, "max_tokens está obsoleto");
    assert.equal(cuerpo.reasoning_effort, undefined, "sin configurar, no se envía");
    assert.equal(cuerpo.response_format.type, "json_schema");
    assert.equal(cuerpo.response_format.json_schema.strict, true);
    assert.equal(cuerpo.response_format.json_schema.schema.additionalProperties, false);
    assert.deepEqual(cuerpo.messages.map((m) => m.role), ["system", "user"]);
    assert.equal(opciones.body.includes(CLAVE), false, "la clave solo va en la cabecera");
  });

  it("envía reasoning_effort solo si se configuró", async () => {
    const f = falsoFetch(respuestaOpenAI(propuestaVocales()));
    await generadorCon(f, { esfuerzoRazonamiento: "low" }).generar(solicitud("vocales"));
    assert.equal(JSON.parse(f.llamadas[0].opciones.body).reasoning_effort, "low");
    assert.throws(() => generadorCon(f, { esfuerzoRazonamiento: "Low; DROP" }), /esfuerzoRazonamiento/);
  });

  it("exige clave, modelo y tope de salida, y es un GeneradorContenidoIA", () => {
    assert.throws(() => new GeneradorContenidoOpenAI({ modelo: "m", maxTokensSalida: 10, fetchFn: async () => {} }), /apiKey/);
    assert.throws(() => new GeneradorContenidoOpenAI({ apiKey: CLAVE, modelo: "m", fetchFn: async () => {} }), /maxTokensSalida/);
    assert.ok(generadorCon(async () => {}) instanceof GeneradorContenidoIA);
  });
});

describe("GeneradorContenidoOpenAI: la respuesta", () => {
  it("arma ejercicios válidos y devuelve el consumo (completion_tokens ya incluye el razonamiento)", async () => {
    const r = await generadorCon(falsoFetch(respuestaOpenAI(propuestaVocales()))).generar(solicitud("vocales"));
    assert.equal(r.titulo, "Vocales con animales");
    assert.equal(r.ejercicios.length, 5);
    assert.doesNotThrow(() => validar("vocales", r.ejercicios));
    assert.deepEqual(r.uso, { proveedor: "openai", modelo: "modelo-x", tokensEntrada: 400, tokensSalida: 200 });
  });

  it("los null de los campos opcionales se tratan como ausentes", async () => {
    const r = await generadorCon(falsoFetch(respuestaOpenAI(propuestaVocales(true)))).generar(solicitud("vocales"));
    assert.doesNotThrow(() => validar("vocales", r.ejercicios));
    assert.equal(r.ejercicios[1].pista, undefined);
  });

  it("sin datos de consumo, el consumo queda desconocido", async () => {
    const r = await generadorCon(falsoFetch(respuestaOpenAI(propuestaVocales(), { usage: null }))).generar(solicitud("vocales"));
    assert.equal(r.uso.tokensEntrada, undefined);
    assert.equal(r.uso.proveedor, "openai");
  });

  it("un rechazo (refusal) o el filtro de contenido es GENERADOR_BLOQUEADO", async () => {
    const rechazo = respuestaOpenAI(null, { message: { role: "assistant", content: null, refusal: "No puedo ayudar con eso" } });
    assert.equal(await codigoDe(generadorCon(falsoFetch(rechazo)).generar(solicitud("vocales"))), "GENERADOR_BLOQUEADO");
    assert.equal(await codigoDe(generadorCon(falsoFetch(respuestaOpenAI(propuestaVocales(), { finish: "content_filter" }))).generar(solicitud("vocales"))), "GENERADOR_BLOQUEADO");
  });

  it("una respuesta cortada (length) es incompleta y conserva el consumo ya gastado", async () => {
    const g = generadorCon(falsoFetch(respuestaOpenAI(propuestaVocales(), { finish: "length" })));
    await assert.rejects(() => g.generar(solicitud("vocales")), (e) => {
      assert.equal(e.codigo, "GENERADOR_RESPUESTA_INCOMPLETA");
      assert.equal(e.uso.tokensEntrada, 400);
      return true;
    });
  });

  it("sin opciones, con JSON inválido o con otra forma, falla con un código claro", async () => {
    assert.equal(await codigoDe(generadorCon(falsoFetch({ choices: [] })).generar(solicitud("vocales"))), "GENERADOR_RESPUESTA_VACIA");
    const texto = (content) => respuestaOpenAI(null, { message: { role: "assistant", content } });
    assert.equal(await codigoDe(generadorCon(falsoFetch(texto("esto no es json"))).generar(solicitud("vocales"))), "GENERADOR_RESPUESTA_INVALIDA");
    assert.equal(await codigoDe(generadorCon(falsoFetch(texto('{"ejercicios":"no"}'))).generar(solicitud("vocales"))), "GENERADOR_RESPUESTA_INVALIDA");
    assert.equal(await codigoDe(generadorCon(falsoFetch(texto(null))).generar(solicitud("vocales"))), "GENERADOR_RESPUESTA_INVALIDA");
  });

  it("un error HTTP no filtra la clave ni el cuerpo del proveedor", async () => {
    const g = generadorCon(falsoFetch({ error: { message: `clave ${CLAVE} inválida` } }, { ok: false, status: 401 }));
    await assert.rejects(() => g.generar(solicitud("vocales")), (e) => {
      assert.equal(e.codigo, "GENERADOR_ERROR");
      assert.match(e.message, /401/);
      assert.equal(e.message.includes(CLAVE), false);
      return true;
    });
  });

  it("una cancelación o un fallo de red se distinguen", async () => {
    const control = new AbortController();
    control.abort();
    const enRed = async () => { throw new Error(`fallo con ${CLAVE}`); };
    assert.equal(await codigoDe(generadorCon(enRed).generar(solicitud("vocales"), { signal: control.signal })), "GENERADOR_TIEMPO_AGOTADO");
    await assert.rejects(() => generadorCon(enRed).generar(solicitud("vocales")), (e) => e.codigo === "GENERADOR_ERROR" && !e.message.includes(CLAVE));
  });
});

describe("crearGenerador con AI_PROVEEDOR=openai", () => {
  const base = { AI_PROVEEDOR: "openai", OPENAI_API_KEY: CLAVE, OPENAI_MODELO: "modelo-x", AI_MAX_TOKENS_SALIDA: "2000" };

  it("sin clave, modelo o tope de salida no arranca y dice cuáles faltan", () => {
    assert.throws(() => crearGenerador({ AI_PROVEEDOR: "openai" }), /OPENAI_API_KEY, OPENAI_MODELO, AI_MAX_TOKENS_SALIDA/);
    assert.throws(() => crearGenerador({ ...base, OPENAI_MODELO: "  " }), /OPENAI_MODELO/);
  });

  it("con todo definido crea el generador de OpenAI, con razonamiento opcional", () => {
    const g = crearGenerador(base);
    assert.ok(g instanceof GeneradorContenidoOpenAI);
    assert.equal(g.maxTokensSalida, 2000);
    assert.equal(g.esfuerzoRazonamiento, undefined);
    assert.equal(crearGenerador({ ...base, OPENAI_RAZONAMIENTO: " low " }).esfuerzoRazonamiento, "low");
  });

  it("un proveedor desconocido lista los disponibles", () => {
    assert.throws(() => crearGenerador({ AI_PROVEEDOR: "otro" }), /"falso", "openai" o "gemini"/);
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const { crearGenerador } = require("../../../../src/lib/Generacion/Infraestructura/http");
const CatalogoRecursosJson = require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const ErrorDelGenerador = require("../../../../src/lib/Compartido/Dominio/Errores/ErrorDelGenerador");

// GENERADOR_FALSO_DEMORA_MS: el generador falso espera ese tiempo antes de responder, para ver en la interfaz el estado
// "generando" y para probar tiempos límite y cancelaciones sin proveedor real.
const catalogo = new CatalogoRecursosJson();
const solicitud = { habilidad: "contar_silabas", mecanica: "seleccionar_opcion", tematica: "animales", cantidad: 5, recursos: catalogo.listar({ tematica: "animales" }) };
const tiempo = async (promesa) => { const inicio = performance.now(); await promesa; return performance.now() - inicio; };
const agotado = (e) => e instanceof ErrorDelGenerador && e.codigo === "GENERADOR_TIEMPO_AGOTADO";

describe("GeneradorContenidoFalso: demora simulada", () => {
  it("sin demora configurada responde de inmediato", async () => {
    assert.ok(await tiempo(new GeneradorContenidoFalso().generar(solicitud)) < 500);
  });

  it("con demoraMs espera ese tiempo antes de responder, y responde lo mismo", async () => {
    const lento = new GeneradorContenidoFalso({ demoraMs: 80 });
    let resultado;
    const espera = await tiempo(lento.generar(solicitud).then((r) => { resultado = r; }));
    assert.ok(espera >= 70, `esperó ${espera} ms`);
    assert.deepEqual(resultado, await new GeneradorContenidoFalso().generar(solicitud));
  });

  it("una cancelación durante la espera la corta enseguida, sin producir contenido", async () => {
    const controlador = new AbortController();
    const lento = new GeneradorContenidoFalso({ demoraMs: 5000 });
    const llamada = lento.generar(solicitud, { signal: controlador.signal });
    setTimeout(() => controlador.abort(), 20);
    let error;
    const espera = await tiempo(llamada.catch((e) => { error = e; }));
    assert.ok(agotado(error), "cancelada con GENERADOR_TIEMPO_AGOTADO");
    assert.ok(espera < 1000, `tardó ${espera} ms en cortarse`);
  });

  it("ya cancelada, ni siquiera empieza a esperar", async () => {
    const controlador = new AbortController();
    controlador.abort();
    const espera = await tiempo(new GeneradorContenidoFalso({ demoraMs: 5000 }).generar(solicitud, { signal: controlador.signal }).catch(() => {}));
    assert.ok(espera < 1000);
  });

  it("también aplica a la temática libre", async () => {
    const { filtro, emojis } = { filtro: new (require("../../../../src/lib/Juego/Infraestructura/FiltroContenidoJson"))(), emojis: new (require("../../../../src/lib/Juego/Infraestructura/EmojisPermitidosJson"))() };
    const g = new GeneradorContenidoFalso({ demoraMs: 80, filtroContenido: filtro, emojisPermitidos: emojis });
    const espera = await tiempo(g.generar({ habilidad: "vocales", mecanica: "seleccionar_opcion", modoTematica: "libre", tematica: "frutas", cantidad: 5 }));
    assert.ok(espera >= 70, `esperó ${espera} ms`);
  });

  it("una demora que no es un entero no negativo no deja crear el generador", () => {
    for (const mala of [-1, 1.5, "100", NaN, Infinity]) assert.throws(() => new GeneradorContenidoFalso({ demoraMs: mala }), /demoraMs/, String(mala));
  });
});

describe("crearGenerador: GENERADOR_FALSO_DEMORA_MS", () => {
  it("la lee del entorno", async () => {
    const g = crearGenerador({ AI_PROVEEDOR: "falso", GENERADOR_FALSO_DEMORA_MS: "80" });
    assert.ok(await tiempo(g.generar(solicitud)) >= 70);
  });

  it("vacía o sin definir significa sin demora", async () => {
    for (const env of [{}, { GENERADOR_FALSO_DEMORA_MS: "" }, { GENERADOR_FALSO_DEMORA_MS: "  " }]) {
      assert.equal(crearGenerador(env).demoraMs, 0);
    }
  });

  it("un valor inválido impide arrancar, con un mensaje que nombra la variable", () => {
    for (const malo of ["abc", "-5", "1.5", "2 s"]) {
      assert.throws(() => crearGenerador({ GENERADOR_FALSO_DEMORA_MS: malo }), /GENERADOR_FALSO_DEMORA_MS/, malo);
    }
  });

  it("con el proveedor real no tiene efecto (ni se valida)", () => {
    const g = crearGenerador({ AI_PROVEEDOR: "gemini", GEMINI_API_KEY: "k", GEMINI_MODELO: "m", AI_MAX_TOKENS_SALIDA: "1500", GENERADOR_FALSO_DEMORA_MS: "abc" });
    assert.equal(g.constructor.name, "GeneradorContenidoIA");
  });
});

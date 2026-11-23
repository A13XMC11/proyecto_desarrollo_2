const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const GeneradorContenidoIA = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoIA");
const { seleccionarEjerciciosLibres } = require("../../../../src/lib/Generacion/Infraestructura/armarEjerciciosLibres");
const { candidatasPedidas } = require("../../../../src/lib/Generacion/Infraestructura/construirPromptGeneracion");
const FiltroContenidoJson = require("../../../../src/lib/Juego/Infraestructura/FiltroContenidoJson");
const EmojisPermitidosJson = require("../../../../src/lib/Juego/Infraestructura/EmojisPermitidosJson");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const { evaluarPalabra } = require("../../../../src/lib/Juego/Dominio/Entidades/ValidacionContenidoLibre");
const ErrorDelGenerador = require("../../../../src/lib/Compartido/Dominio/Errores/ErrorDelGenerador");
const { COMPATIBILIDAD } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");
const diccionario = require("../../../../src/lib/Generacion/Infraestructura/falso/contenidoFalsoLibre.json");

// Sin proveedor, sin red y sin costo: el generador falso arma candidatas de ejemplo y las pasa por el MISMO selector
// y la MISMA validación que el generador con IA.
const filtro = new FiltroContenidoJson();
const emojis = new EmojisPermitidosJson();
const falso = new GeneradorContenidoFalso({ filtroContenido: filtro, emojisPermitidos: emojis });

const HABILIDADES = ["vocales", "palabras_silabas", "completar_silaba", "contar_silabas"];
const TEMAS = ["frutas", "colores", "animales", "dinosaurios del espacio"]; // la última no está en el diccionario
const TITULOS = { vocales: "Vocales", palabras_silabas: "Sílabas", completar_silaba: "La sílaba que falta", contar_silabas: "Cuenta las sílabas" };
const solicitud = (habilidad, tematica, cantidad = 5, extra = {}) =>
  ({ habilidad, mecanica: COMPATIBILIDAD[habilidad], modoTematica: "libre", tematica, cantidad, franjaEdad: 6, ...extra });
const validar = (habilidad, tematica, cantidad, ejercicios) =>
  new VersionJuego({
    juegoId: "j1", ejercicios,
    configuracion: { habilidad, mecanica: COMPATIBILIDAD[habilidad], modoTematica: "libre", tematica, cantidadEjercicios: cantidad }
  }).validarContenido(undefined, { permitirDiez: true, filtroContenido: filtro, emojisPermitidos: emojis });
const palabrasDe = (e) => e.palabraId || e.objetivo;

describe("GeneradorContenidoFalso: temática libre", () => {
  for (const habilidad of HABILIDADES) {
    for (const tematica of TEMAS) {
      for (const cantidad of [5, 10]) {
        it(`${habilidad} / ${tematica} / ${cantidad}: produce una actividad que el Dominio acepta, sin palabras repetidas`, async () => {
          const { titulo, ejercicios, uso } = await falso.generar(solicitud(habilidad, tematica, cantidad));
          assert.equal(ejercicios.length, cantidad);
          assert.ok(titulo.length >= 3 && titulo.length <= 80, `título de ${titulo.length} caracteres`);
          assert.deepEqual([uso.proveedor, uso.tokensEntrada, uso.tokensSalida], ["falso", 0, 0]);
          assert.doesNotThrow(() => VersionJuego.rechazarCamposDesconocidos(ejercicios));
          assert.doesNotThrow(() => validar(habilidad, tematica, cantidad, ejercicios));
          const palabras = ejercicios.map((e) => palabrasDe(e).toLowerCase());
          assert.equal(new Set(palabras).size, cantidad, "sin duplicados");
        });
      }
    }
  }

  it("usa el MISMO selector que el generador con IA: su salida es la del selector con sus candidatas", async () => {
    for (const habilidad of HABILIDADES) {
      for (const cantidad of [5, 10]) {
        const s = solicitud(habilidad, "frutas", cantidad);
        const candidatas = falso.candidatas(s);
        const esperado = seleccionarEjerciciosLibres({
          habilidad, mecanica: s.mecanica, tematica: s.tematica, cantidad, candidatas, filtroContenido: filtro, emojisPermitidos: emojis
        });
        assert.deepEqual((await falso.generar(s)).ejercicios, esperado, `${habilidad} · ${cantidad}`);
        // y el generador con IA, alimentado con esas mismas candidatas, produce exactamente lo mismo
        const respuesta = { candidates: [{ content: { parts: [{ text: JSON.stringify({ candidatas }) }] }, finishReason: "STOP" }] };
        const ia = new GeneradorContenidoIA({
          apiKey: "clave-de-prueba", modelo: "m", maxTokensSalida: 2000, filtroContenido: filtro, emojisPermitidos: emojis,
          fetchFn: async () => ({ ok: true, status: 200, json: async () => respuesta })
        });
        assert.deepEqual((await ia.generar(s)).ejercicios, esperado, `IA · ${habilidad} · ${cantidad}`);
      }
    }
  });

  it("pide el doble de candidatas, igual que el real (con tope de 20)", () => {
    assert.equal(falso.candidatas(solicitud("contar_silabas", "frutas", 5)).length, candidatasPedidas(5));
    assert.equal(falso.candidatas(solicitud("contar_silabas", "frutas", 10)).length, candidatasPedidas(10));
    assert.equal(candidatasPedidas(10), 20);
  });

  it("las candidatas tienen la forma del contrato de la IA: solo palabra, icono opcional, consigna y pista", () => {
    for (const habilidad of HABILIDADES) {
      for (const c of falso.candidatas(solicitud(habilidad, "animales", 5))) {
        assert.ok(Object.keys(c).every((k) => ["palabra", "icono", "consigna", "pista"].includes(k)), JSON.stringify(c));
        assert.ok(typeof c.palabra === "string" && typeof c.consigna === "string");
      }
    }
  });

  it("es determinista: la misma entrada da siempre la misma salida, aun con otra instancia", async () => {
    for (const habilidad of HABILIDADES) {
      const s = solicitud(habilidad, "colores", 10);
      const otra = new GeneradorContenidoFalso({ filtroContenido: filtro, emojisPermitidos: emojis });
      const a = await falso.generar(s);
      const b = await falso.generar(s);
      const c = await otra.generar(s);
      assert.deepEqual(b, a);
      assert.deepEqual(c, a);
    }
  });

  it("no hace ninguna llamada de red", async () => {
    const original = globalThis.fetch;
    let llamadas = 0;
    globalThis.fetch = () => { llamadas += 1; throw new Error("el generador falso no debe usar la red"); };
    try {
      for (const habilidad of HABILIDADES) await falso.generar(solicitud(habilidad, "dinosaurios", 5));
    } finally {
      globalThis.fetch = original;
    }
    assert.equal(llamadas, 0);
  });

  it("reconoce las temáticas del diccionario por su nombre o por una de sus palabras", async () => {
    const palabrasDeTema = (clave) => new Set(diccionario.tematicas[clave].palabras.map((p) => p.palabra.toLowerCase()));
    const casos = [
      ["Frutas", "frutas"], ["frutas tropicales", "frutas"], ["sonidos de animales", "animales"], ["Los Colores", "colores"],
      ["medios de transporte", "transporte"], ["la escuela", "escuela"], ["cuerpo humano", "cuerpo"], ["comida", "comida"]
    ];
    for (const [texto, clave] of casos) {
      const { ejercicios } = await falso.generar(solicitud("contar_silabas", texto, 5));
      assert.ok(ejercicios.every((e) => palabrasDeTema(clave).has(e.objetivo.toLowerCase())), `${texto} -> ${clave}`);
    }
  });

  it("una temática desconocida usa el conjunto genérico y queda marcada como contenido de ejemplo", async () => {
    const generico = new Set(diccionario.generico.palabras.map((p) => p.palabra.toLowerCase()));
    for (const habilidad of HABILIDADES) {
      const { titulo, ejercicios } = await falso.generar(solicitud(habilidad, "dinosaurios del espacio", 5));
      assert.ok(ejercicios.every((e) => generico.has(palabrasDe(e).toLowerCase())), habilidad);
      assert.match(titulo, /contenido de ejemplo/i);
      assert.ok(titulo.startsWith(`${TITULOS[habilidad]}: dinosaurios del espacio`), titulo);
    }
  });

  it("el título con la marca de ejemplo nunca pasa de 80 caracteres, ni con la temática más larga", async () => {
    const larga = "abcdefghij klmnopqrst uvwxyzabcd efghijk"; // justo 40 caracteres (el máximo de una temática)
    assert.equal(larga.length, 40);
    for (const habilidad of HABILIDADES) {
      const { titulo } = await falso.generar(solicitud(habilidad, larga, 5));
      assert.ok(titulo.length <= 80, `${titulo.length}: ${titulo}`);
      assert.match(titulo, /contenido de ejemplo/i);
    }
  });

  it("una temática del diccionario no lleva la marca de contenido desconocido", async () => {
    const { titulo } = await falso.generar(solicitud("vocales", "frutas", 5));
    assert.equal(titulo, "Vocales: frutas");
  });

  it("algunas palabras salen sin icono y otras con él (se ejercitan los dos caminos)", async () => {
    const { ejercicios } = await falso.generar(solicitud("completar_silaba", "frutas", 10));
    assert.ok(ejercicios.some((e) => e.icono), "alguna con icono");
    assert.ok(ejercicios.some((e) => !e.icono), "alguna sin icono");
  });

  it("los colores se dan siempre como texto, sin iconos de color", async () => {
    for (const habilidad of HABILIDADES) {
      const { ejercicios } = await falso.generar(solicitud(habilidad, "colores", 10));
      assert.ok(ejercicios.every((e) => !e.icono), habilidad);
    }
  });

  it("sin filtro o sin lista de iconos, la temática libre falla ANTES de producir nada", async () => {
    for (const deps of [{}, { filtroContenido: filtro }, { emojisPermitidos: emojis }]) {
      await assert.rejects(new GeneradorContenidoFalso(deps).generar(solicitud("vocales", "frutas")), /filtroContenido y emojisPermitidos/);
    }
  });

  it("respeta la cancelación como el modo catálogo", async () => {
    const controlador = new AbortController();
    controlador.abort();
    await assert.rejects(falso.generar(solicitud("vocales", "frutas"), { signal: controlador.signal }),
      (e) => e instanceof ErrorDelGenerador && e.codigo === "GENERADOR_TIEMPO_AGOTADO");
  });

  it("si faltaran palabras, falla con GENERADOR_CANDIDATAS_INSUFICIENTES (no inventa palabras)", async () => {
    // Un diccionario mínimo: ninguna palabra empieza con vocal, así que vocales no puede reunir ni un ejercicio
    const pobre = new GeneradorContenidoFalso({
      filtroContenido: filtro, emojisPermitidos: emojis,
      contenido: { tematicas: { frutas: { alias: ["frutas"], palabras: [{ palabra: "pera" }, { palabra: "mora" }] } }, generico: { palabras: [{ palabra: "mesa" }] } }
    });
    await assert.rejects(pobre.generar(solicitud("vocales", "frutas", 5)), (e) => e.codigo === "GENERADOR_CANDIDATAS_INSUFICIENTES");
  });
});

describe("contenidoFalsoLibre.json: el diccionario de ejemplo", () => {
  const grupos = [
    ...Object.entries(diccionario.tematicas).map(([clave, t]) => [clave, t.palabras]),
    ["generico", diccionario.generico.palabras]
  ];

  it("incluye las temáticas pedidas: frutas, colores, animales, transporte, escuela, cuerpo y comida", () => {
    assert.deepEqual(Object.keys(diccionario.tematicas).sort(), ["animales", "colores", "comida", "cuerpo", "escuela", "frutas", "transporte"]);
  });

  for (const [clave, palabras] of grupos) {
    it(`${clave}: cada palabra pasa el filtro y cada icono está en la lista; sin repetidas`, () => {
      const vistas = new Set();
      for (const { palabra, icono, ...resto } of palabras) {
        assert.deepEqual(Object.keys(resto), [], `${palabra}: campos extra`);
        assert.equal(filtro.evaluar(palabra).permitido, true, palabra);
        if (icono !== undefined) assert.equal(emojis.esPermitido(icono), true, `${palabra}: ${icono}`);
        assert.ok(!vistas.has(palabra.toLowerCase()), `repetida: ${palabra}`);
        vistas.add(palabra.toLowerCase());
      }
    });

    it(`${clave}: cada palabra sirve para al menos una habilidad con el Silabeador`, () => {
      for (const { palabra } of palabras) {
        const sirve = HABILIDADES.some((h) => { try { evaluarPalabra(palabra, h, filtro); return true; } catch { return false; } });
        assert.ok(sirve, `${palabra} no sirve para ninguna habilidad`);
      }
    });
  }

  it("los alias son minúsculas y sin tildes, y no se repiten entre temáticas", () => {
    const todos = Object.values(diccionario.tematicas).flatMap((t) => t.alias);
    assert.ok(todos.every((a) => a === a.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()));
    assert.equal(new Set(todos).size, todos.length);
  });

  // La capacidad real: cuántos ejercicios distintos puede producir cada combinación pasando por el selector
  it("capacidad: cada temática y el conjunto genérico alcanzan para 10 ejercicios de cada habilidad", async () => {
    const tabla = [];
    for (const tematica of [...Object.keys(diccionario.tematicas), "tema desconocido"]) {
      for (const habilidad of HABILIDADES) {
        const disponibles = falso.candidatas(solicitud(habilidad, tematica, 10)).length;
        tabla.push(`${tematica}/${habilidad}=${disponibles}`);
        const { ejercicios } = await falso.generar(solicitud(habilidad, tematica, 10));
        assert.equal(ejercicios.length, 10, `${tematica}/${habilidad}`);
      }
    }
    assert.ok(tabla.length === 32);
  });
});

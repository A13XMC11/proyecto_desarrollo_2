const { describe } = require("node:test");
const assert = require("node:assert/strict");

// Un cliente hostil habla con la API directamente, sin pasar por la interfaz: ninguna regla de la temática libre puede
// depender de lo que el cliente quiera mostrar. Cada intento debe rechazarse con su código y sin dejar rastro.
Object.assign(process.env, {
  AI_ENABLED: "true", AI_PROVEEDOR: "falso", GENERADOR_FALSO_DEMORA_MS: "0", GENERACION_LIBRE_HABILITADA: "true", PERMITIR_10_EJERCICIOS: "true",
  AI_MAX_DIARIAS: "100", AI_MAX_SIMULTANEAS: "1", AI_TIEMPO_LIMITE_MS: "5000", AI_MARGEN_CONCILIACION_MS: "1000",
  AI_PRESUPUESTO_MENSUAL: "1000000", AI_COSTO_MAXIMO_LLAMADA: "1", AI_TARIFA_ENTRADA_MTOK: "1", AI_TARIFA_SALIDA_MTOK: "2"
});

const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor, registrarDocente } = require("./cliente");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");
const { MECANICAS, actividad, vocal, contar } = require("../ayudas/actividadesLibres");

const prueba = pruebasConBase("clienteHostil", { sql: true, mongo: true });
const llamar = conServidor();

async function escenario() {
  await crearAsegurarCanales().ejecutar();
  const docente = await registrarDocente(llamar);
  const ajeno = await registrarDocente(llamar);
  const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } })).cuerpo.id;
  const estudiante = (await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { cursoId: curso, codigoLista: "A01", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
  return { docente, ajeno, curso, estudiante };
}
const nuevoJuego = async (esc, habilidad = "vocales") =>
  (await llamar("/api/juegos", { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: esc.curso, titulo: "Actividad hostil", habilidad } })).cuerpo.id;
const rutaV = (juego) => `/api/juegos/${juego}/versiones`;
const libreCfg = (extra = {}) => ({ modoTematica: "libre", tematica: "frutas", cantidadEjercicios: 5, ...extra });
const crear = (esc, juego, cuerpo) => llamar(rutaV(juego), { metodo: "POST", docente: esc.docente, cuerpo });
const editar = (esc, juego, version, cuerpo) => llamar(`${rutaV(juego)}/${version}`, { metodo: "PUT", docente: esc.docente, cuerpo });
const aprobar = (esc, juego, version, docente = esc.docente) => llamar(`${rutaV(juego)}/${version}/aprobar`, { metodo: "POST", docente });

// Rechazada con el estado y el código esperados, y sin repetir lo que el cliente hostil envió
function rechazada(r, codigo, etiqueta, { estado = 400, noRepite } = {}) {
  assert.equal(r.status, estado, `${etiqueta}: ${JSON.stringify(r.cuerpo)}`);
  if (codigo) assert.equal(r.cuerpo.codigo, codigo, `${etiqueta}: ${JSON.stringify(r.cuerpo)}`);
  if (noRepite) assert.ok(!noRepite.test(JSON.stringify(r.cuerpo)), `${etiqueta}: la respuesta repite lo enviado`);
}

const buenos = () => actividad("vocales", "frutas");
const con = (lista, i, cambio) => lista.map((e, k) => (k === i ? { ...e, ...cambio } : e));

describe("Cliente hostil: contenido de una versión libre (crear y editar)", () => {
  // Cada caso fabrica ejercicios malos; deben fallar igual al CREAR la versión y al EDITAR un borrador existente
  const CASOS = [
    ["palabra bloqueada", () => con(buenos(), 0, { objetivo: "arma" }), "PALABRA_NO_PERMITIDA", /arma/i],
    ["palabra bloqueada con letras separadas", () => con(buenos(), 0, { objetivo: "a r m a" }), null, /arma/i],
    ["icono fuera de la lista (cuchillo)", () => con(buenos(), 0, { icono: "🔪" }), "ICONO_NO_PERMITIDO"],
    ["icono que ni es un emoji", () => con(buenos(), 0, { icono: "abc" }), null],
    ["icono de color suelto", () => con(buenos(), 0, { icono: "🔴" }), "ICONO_NO_PERMITIDO"],
    ["campo extra en el ejercicio", () => con(buenos(), 0, { script: "alert(1)" }), null, /alert/],
    ["consigna con un término bloqueado", () => con(buenos(), 0, { consigna: "Mira esta arma. ¿Con qué vocal empieza la palabra?" }), "TEXTO_NO_PERMITIDO", /arma/i],
    ["pista con un término bloqueado", () => con(buenos(), 0, { pista: "Piensa en la violencia" }), "TEXTO_NO_PERMITIDO", /violencia/i],
    ["consigna que revela la respuesta", () => con(buenos(), 0, { consigna: "La respuesta es uva" }), "RESPUESTA_REVELADA"],
    ["palabra repetida", () => con(buenos(), 1, vocal(2, "uva")), "PALABRA_REPETIDA"],
    ["respuesta correcta equivocada", () => con(buenos(), 0, { respuestaCorrectaId: "o1" }), "RESPUESTA_INCORRECTA"],
    ["opciones repetidas", () => con(buenos(), 0, { opciones: [{ id: "o1", texto: "A" }, { id: "o2", texto: "A" }, { id: "o3", texto: "U" }] }), null],
    ["palabra que no empieza con vocal", () => con(buenos(), 0, { objetivo: "pera" }), "PALABRA_NO_EMPIEZA_CON_VOCAL"],
    ["palabra con símbolos o números", () => con(buenos(), 0, { objetivo: "uva2" }), "PALABRA_INVALIDA"],
    ["código inyectado como palabra", () => con(buenos(), 0, { objetivo: "<script>alert(1)</script>" }), null, /script/]
  ];

  for (const [nombre, fabricar, codigo, noRepite] of CASOS) {
    prueba(`${nombre}: se rechaza al crear y al editar, y el borrador no cambia`, async () => {
      const esc = await escenario();
      const juego = await nuevoJuego(esc);
      const r = await crear(esc, juego, libreCfg({ ejercicios: fabricar() }));
      rechazada(r, codigo, `crear · ${nombre}`, { noRepite });
      assert.deepEqual((await llamar(rutaV(juego), { docente: esc.docente })).cuerpo, [], "no se guardó nada");

      const ok = await crear(esc, juego, libreCfg({ ejercicios: buenos() }));
      assert.equal(ok.status, 201, JSON.stringify(ok.cuerpo));
      const e = await editar(esc, juego, ok.cuerpo.id, { ejercicios: fabricar() });
      rechazada(e, codigo, `editar · ${nombre}`, { noRepite });
      const despues = (await llamar(`${rutaV(juego)}/${ok.cuerpo.id}`, { docente: esc.docente })).cuerpo;
      assert.deepEqual(despues.ejercicios.map((x) => x.objetivo), buenos().map((x) => x.objetivo), "un PUT inválido no cambia lo guardado");
    });
  }

  prueba("un hiato (león) o una palabra dudosa en contar sílabas se rechaza con SILABEO_DUDOSO, y las sílabas fuera de rango también", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc, "contar_silabas");
    const base = actividad("contar_silabas", "animales");
    rechazada(await crear(esc, juego, libreCfg({ tematica: "animales", ejercicios: con(base, 0, contar(1, "león", 2)) })), "SILABEO_DUDOSO", "hiato");
    rechazada(await crear(esc, juego, libreCfg({ tematica: "animales", ejercicios: con(base, 0, contar(1, "guau", 1)) })), null, "onomatopeya");
    rechazada(await crear(esc, juego, libreCfg({ tematica: "animales", ejercicios: con(base, 0, contar(1, "electroencefalograma", 9)) })), null, "demasiado larga");
    assert.deepEqual((await llamar(rutaV(juego), { docente: esc.docente })).cuerpo, []);
  });

  prueba("una versión libre con palabraId o recursoId ajenos al contrato no cuela una palabra por otra vía", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    // La palabra que se corrige es la del objetivo: un palabraId distinto no puede esconder una bloqueada
    const r = await crear(esc, juego, libreCfg({ ejercicios: con(buenos(), 0, { palabraId: "arma" }) }));
    assert.equal(r.status, 400, JSON.stringify(r.cuerpo));
    rechazada(await crear(esc, juego, libreCfg({ ejercicios: con(buenos(), 0, { recursoId: "abeja" }) })), "ESTRUCTURA_INVALIDA", "recursoId en libre");
    assert.deepEqual((await llamar(rutaV(juego), { docente: esc.docente })).cuerpo, []);
  });
});

describe("Cliente hostil: configuración de la versión (modo y temática)", () => {
  prueba("una versión del catálogo con una temática de texto libre se rechaza; una libre con símbolos, largo o tipos raros también", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    for (const cuerpo of [
      { modoTematica: "catalogo", tematica: "frutas", cantidadEjercicios: 5, ejercicios: [] },
      { tematica: "frutas", cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: "libre", tematica: "<b>frutas</b>", cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: "libre", tematica: "a".repeat(41), cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: "libre", tematica: "ab", cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: "libre", tematica: "frutas 2", cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: "libre", tematica: { $ne: "x" }, cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: "libre", tematica: ["frutas"], cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: ["libre"], tematica: "frutas", cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: { $ne: "catalogo" }, tematica: "animales", cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: "otro", tematica: "frutas", cantidadEjercicios: 5, ejercicios: [] },
      { modoTematica: "libre", tematica: "frutas", cantidadEjercicios: 7, ejercicios: [] },
      { modoTematica: "libre", tematica: "frutas", cantidadEjercicios: "5", ejercicios: [] }
    ]) {
      const r = await crear(esc, juego, cuerpo);
      assert.equal(r.status, 400, JSON.stringify(cuerpo));
    }
    assert.deepEqual((await llamar(rutaV(juego), { docente: esc.docente })).cuerpo, []);
  });

  prueba("una temática libre bloqueada no se puede guardar en una versión (el filtro vale también por la API directa)", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    for (const tematica of ["pistolas y armas", "p u t a", "drogas y alcohol"]) {
      const r = await crear(esc, juego, libreCfg({ tematica, ejercicios: [] }));
      rechazada(r, "TEMATICA_NO_PERMITIDA", `versión · ${tematica}`, { noRepite: /pistola|arma|puta|droga|alcohol/i });
    }
    assert.deepEqual((await llamar(rutaV(juego), { docente: esc.docente })).cuerpo, []);
  });

  prueba("un PUT no puede cambiar el modo, la temática, el estado ni el juego de una versión", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    const v = (await crear(esc, juego, libreCfg({ ejercicios: buenos() }))).cuerpo;
    const r = await editar(esc, juego, v.id, {
      ejercicios: buenos(), modoTematica: "catalogo", tematica: "animales", estado: "aprobada", juegoId: "otro", configuracion: { modoTematica: "catalogo", tematica: "animales" }, numero: 99
    });
    assert.equal(r.status, 200, "los campos que no son ejercicios se ignoran: " + JSON.stringify(r.cuerpo));
    const despues = (await llamar(`${rutaV(juego)}/${v.id}`, { docente: esc.docente })).cuerpo;
    assert.deepEqual([despues.estado, despues.configuracion.modoTematica, despues.configuracion.tematica, despues.numero], ["borrador", "libre", "frutas", 1]);
  });
});

describe("Cliente hostil: aprobar e inmutabilidad", () => {
  prueba("aprobar un borrador inválido o incompleto se rechaza y la versión sigue siendo borrador", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    const incompleto = (await crear(esc, juego, libreCfg({ ejercicios: buenos().slice(0, 3) }))).cuerpo;
    const r = await aprobar(esc, juego, incompleto.id);
    assert.equal(r.status, 400, JSON.stringify(r.cuerpo));
    assert.equal((await llamar(`${rutaV(juego)}/${incompleto.id}`, { docente: esc.docente })).cuerpo.estado, "borrador");
    assert.equal((await llamar(`/api/juegos/${juego}`, { docente: esc.docente })).cuerpo.estado, "borrador");
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" } })).status, 409, "no se juega un borrador");
  });

  prueba("una versión aprobada es inmutable: no se edita, no se aprueba otra vez ni se descarta, y crear otra no la toca", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    const v = (await crear(esc, juego, libreCfg({ ejercicios: buenos() }))).cuerpo;
    assert.equal((await aprobar(esc, juego, v.id)).status, 200);
    const original = (await llamar(`${rutaV(juego)}/${v.id}`, { docente: esc.docente })).cuerpo;

    rechazada(await editar(esc, juego, v.id, { ejercicios: buenos() }), "VERSION_NO_EDITABLE", "editar aprobada", { estado: 409 });
    rechazada(await editar(esc, juego, v.id, { ejercicios: con(buenos(), 0, { objetivo: "arma" }), modoTematica: "catalogo", tematica: "animales" }), null, "editar aprobada con otro modo", { estado: 409 });
    const otra = await aprobar(esc, juego, v.id);
    assert.ok([400, 409].includes(otra.status), "aprobar dos veces no es posible");
    const des = await llamar(`${rutaV(juego)}/${v.id}`, { metodo: "DELETE", docente: esc.docente });
    assert.ok([400, 409].includes(des.status), `descartar una aprobada: ${des.status}`);

    // Pedir «otra versión» con otro modo crea una versión NUEVA (borrador); la aprobada queda exactamente igual
    const nueva = await crear(esc, juego, { modoTematica: "catalogo", tematica: "animales", cantidadEjercicios: 5, ejercicios: [] });
    assert.equal(nueva.status, 201);
    assert.equal(nueva.cuerpo.numero, 2);
    const despues = (await llamar(`${rutaV(juego)}/${v.id}`, { docente: esc.docente })).cuerpo;
    assert.deepEqual(despues, original);
    assert.deepEqual([despues.estado, despues.configuracion.modoTematica, despues.configuracion.tematica], ["aprobada", "libre", "frutas"]);
  });

  prueba("lo que se juega es la versión aprobada: editar después no altera la partida que ya empezó", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    const v = (await crear(esc, juego, libreCfg({ ejercicios: buenos() }))).cuerpo;
    await aprobar(esc, juego, v.id);
    const partida = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" } })).cuerpo.id;
    // Un borrador nuevo con otro contenido no cambia el jugable de la partida
    const nueva = (await crear(esc, juego, libreCfg({ tematica: "colores", ejercicios: actividad("vocales", "colores") }))).cuerpo;
    assert.ok(nueva.id);
    const jugable = (await llamar(`/api/partidas/${partida}/jugable`, { docente: esc.docente })).cuerpo;
    assert.deepEqual(jugable.ejercicios.map((e) => e.objetivo), buenos().map((e) => e.objetivo));
  });
});

describe("Cliente hostil: ids ajenos y sin sesión", () => {
  prueba("con ids de otro docente todo responde 404 (juegos, versiones y partidas), y no filtra nada", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    const v = (await crear(esc, juego, libreCfg({ ejercicios: buenos() }))).cuerpo;
    await aprobar(esc, juego, v.id);
    const partida = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" } })).cuerpo.id;
    const a = esc.ajeno;
    const intentos = [
      ["GET juego", `/api/juegos/${juego}`, "GET"],
      ["PUT juego", `/api/juegos/${juego}`, "PUT", { titulo: "Robado" }],
      ["DELETE juego", `/api/juegos/${juego}`, "DELETE"],
      ["POST desarchivar", `/api/juegos/${juego}/desarchivar`, "POST"],
      ["GET versiones", rutaV(juego), "GET"],
      ["POST versión", rutaV(juego), "POST", libreCfg({ ejercicios: buenos() })],
      ["GET versión", `${rutaV(juego)}/${v.id}`, "GET"],
      ["PUT versión", `${rutaV(juego)}/${v.id}`, "PUT", { ejercicios: buenos() }],
      ["aprobar versión", `${rutaV(juego)}/${v.id}/aprobar`, "POST"],
      ["DELETE versión", `${rutaV(juego)}/${v.id}`, "DELETE"],
      ["GET partida", `/api/partidas/${partida}`, "GET"],
      ["jugable", `/api/partidas/${partida}/jugable`, "GET"],
      ["intento", `/api/partidas/${partida}/intentos`, "POST", { ejercicioId: "e1", eleccion: "o1", operacionId: "op-hostil-1" }],
      ["pista", `/api/partidas/${partida}/pistas`, "POST", { ejercicioId: "e1", operacionId: "op-hostil-2" }],
      ["finalizar", `/api/partidas/${partida}/finalizar`, "POST"],
      ["abandonar", `/api/partidas/${partida}`, "DELETE"],
      ["iniciar partida con el juego y el estudiante ajenos", "/api/partidas", "POST", { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" }]
    ];
    for (const [nombre, ruta, metodo, cuerpo] of intentos) {
      const r = await llamar(ruta, { metodo, docente: a, cuerpo });
      assert.equal(r.status, 404, `${nombre}: ${r.status} ${JSON.stringify(r.cuerpo)}`);
      assert.ok(!/frutas|uva|Actividad hostil/.test(JSON.stringify(r.cuerpo)), `${nombre}: filtró datos`);
    }
    // Y nada cambió
    assert.equal((await llamar(`/api/juegos/${juego}`, { docente: esc.docente })).cuerpo.titulo, "Actividad hostil");
    assert.equal((await llamar(`${rutaV(juego)}/${v.id}`, { docente: esc.docente })).cuerpo.estado, "aprobada");
    assert.equal((await llamar(`/api/partidas/${partida}`, { docente: esc.docente })).cuerpo.estado, "en_curso");
  });

  prueba("sin sesión se rechazan los datos (401): iconos, recursos, juegos, versiones, partidas y generaciones", async () => {
    for (const ruta of ["/api/iconos", "/api/recursos?tematica=animales", "/api/juegos", "/api/cuotas", "/api/generaciones", "/api/partidas", "/api/resultados", "/api/inicio"]) {
      assert.equal((await llamar(ruta)).status, 401, ruta);
    }
    assert.equal((await llamar("/api/juegos/000000000000000000000001/versiones", { metodo: "POST", cuerpo: libreCfg({ ejercicios: [] }) })).status, 401);
    assert.equal((await llamar("/api/generaciones", { metodo: "POST", cabeceras: { "idempotency-key": "clave-sin-sesion-0001" }, cuerpo: { modoTematica: "libre", tematica: "frutas" } })).status, 401);
  });

  prueba("las escrituras sin el token CSRF se rechazan (403) aunque haya sesión", async () => {
    const esc = await escenario();
    const juego = await nuevoJuego(esc);
    const r = await llamar(rutaV(juego), { metodo: "POST", docente: esc.docente, sinCsrf: true, cuerpo: libreCfg({ ejercicios: buenos() }) });
    assert.equal(r.status, 403);
    assert.deepEqual((await llamar(rutaV(juego), { docente: esc.docente })).cuerpo, []);
  });
});

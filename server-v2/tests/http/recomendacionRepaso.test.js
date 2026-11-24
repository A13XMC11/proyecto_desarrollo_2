const { describe } = require("node:test");
const assert = require("node:assert/strict");

// La IA se habilita ANTES de que buildApp lea el entorno. Con el redactor falso no hay proveedor, tokens ni costo real.
Object.assign(process.env, {
  AI_ENABLED: "true", AI_PROVEEDOR: "falso", GENERADOR_FALSO_DEMORA_MS: "0", AI_MAX_RECOMENDACIONES_MENSUALES: "2",
  AI_TIEMPO_LIMITE_MS: "5000", AI_MARGEN_CONCILIACION_MS: "1000", AI_PRESUPUESTO_MENSUAL: "1000000",
  AI_COSTO_MAXIMO_LLAMADA: "1", AI_TARIFA_ENTRADA_MTOK: "1", AI_TARIFA_SALIDA_MTOK: "2"
});

const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor, registrarDocente } = require("./cliente");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");

const prueba = pruebasConBase("recomendacionRepaso", { sql: true, mongo: true });
const llamar = conServidor();
const RUTA = "/api/resultados/repaso/recomendacion";

const ejercicio = (n) => {
  const vocal = n === 2 ? "o" : "a";
  return {
    id: `e${n}`, consigna: `¿Con qué vocal empieza esta palabra? (${n})`, pista: "Piensa en el sonido", recursoId: n === 2 ? "oso" : "abeja",
    opciones: [vocal, "e", "i"].map((t) => ({ id: t, texto: t })), respuestaCorrectaId: vocal
  };
};

async function escenario() {
  await crearAsegurarCanales().ejecutar();
  const docente = await registrarDocente(llamar);
  const ajeno = await registrarDocente(llamar);
  const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } })).cuerpo.id;
  const estudiante = (await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { cursoId: curso, codigoLista: "A01", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
  return { docente, ajeno, curso, estudiante };
}

// Una partida terminada: e1 a e3 mal y luego bien; e4 y e5 bien al primer intento (3 de 5 sin acertar al primer intento)
async function jugarPartida(esc) {
  const juego = (await llamar("/api/juegos", { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: esc.curso, titulo: "Las vocales", habilidad: "vocales" } })).cuerpo.id;
  const rutaV = `/api/juegos/${juego}/versiones`;
  const version = (await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: [1, 2, 3, 4, 5].map(ejercicio) } })).cuerpo.id;
  await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });
  const partida = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego } })).cuerpo.id;
  let n = 0;
  const responder = (ejercicioId, eleccion) =>
    llamar(`/api/partidas/${partida}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId, eleccion, operacionId: `rec-${++n}` } });
  for (const [e, buena] of [["e1", "a"], ["e2", "o"], ["e3", "a"]]) { await responder(e, "i"); await responder(e, buena); }
  await responder("e4", "a");
  await responder("e5", "a");
}

describe("HTTP: recomendación de repaso con IA (redactor falso)", () => {
  prueba("exige sesión y token CSRF", async () => {
    const esc = await escenario();
    assert.equal((await llamar(RUTA, { metodo: "POST", cuerpo: {} })).status, 401);
    assert.equal((await llamar(RUTA, { metodo: "POST", docente: esc.docente, sinCsrf: true, cuerpo: {} })).status, 403);
    assert.equal((await llamar(RUTA, { docente: esc.docente })).status, 404, "no hay GET: gasta cupo");
  });

  prueba("con pocas respuestas avisa (409) y no gasta cupo", async () => {
    const esc = await escenario();
    const r = await llamar(RUTA, { metodo: "POST", docente: esc.docente, cuerpo: {} });
    assert.equal(r.status, 409);
    assert.equal(r.cuerpo.codigo, "DATOS_INSUFICIENTES");
  });

  prueba("redacta con las cifras propias, descuenta el cupo mensual y se agota a la tercera", async () => {
    const esc = await escenario();
    await jugarPartida(esc);

    const primera = await llamar(RUTA, { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: esc.curso } });
    assert.equal(primera.status, 200, JSON.stringify(primera.cuerpo));
    assert.match(primera.cuerpo.resumen, /Vocales/);
    assert.match(primera.cuerpo.resumen, /3 de 5/);
    assert.ok(primera.cuerpo.sugerencias.length >= 1);
    assert.equal(primera.cuerpo.cupoRestante, 1);

    assert.equal((await llamar(RUTA, { metodo: "POST", docente: esc.docente, cuerpo: {} })).cuerpo.cupoRestante, 0);

    const tercera = await llamar(RUTA, { metodo: "POST", docente: esc.docente, cuerpo: {} });
    assert.equal(tercera.status, 429);
    assert.equal(tercera.cuerpo.codigo, "RECOMENDACIONES_AGOTADAS");

    // El cupo de recomendaciones no toca el de actividades con IA
    const cuotas = (await llamar("/api/cuotas", { docente: esc.docente })).cuerpo;
    assert.equal(cuotas.diaria?.consumido ?? 0, 0);
  });

  prueba("otro docente no ve estas partidas, y los filtros se validan", async () => {
    const esc = await escenario();
    await jugarPartida(esc);
    const ajeno = await llamar(RUTA, { metodo: "POST", docente: esc.ajeno, cuerpo: {} });
    assert.equal(ajeno.status, 409, "sin datos propios no hay recomendación");

    assert.equal((await llamar(RUTA, { metodo: "POST", docente: esc.docente, cuerpo: { habilidad: "otra" } })).status, 400);
    assert.equal((await llamar(RUTA, { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: { $ne: "x" } } })).status, 200, "los filtros no aceptan operadores");
  });
});

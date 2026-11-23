const { describe } = require("node:test");
const assert = require("node:assert/strict");

// La generación se habilita ANTES de que buildApp lea el entorno. Valores de prueba con el generador falso.
Object.assign(process.env, {
  AI_ENABLED: "true", AI_PROVEEDOR: "falso", GENERADOR_FALSO_DEMORA_MS: "0", GENERACION_LIBRE_HABILITADA: "false", AI_MAX_DIARIAS: "3", AI_MAX_SIMULTANEAS: "1",
  AI_TIEMPO_LIMITE_MS: "5000", AI_MARGEN_CONCILIACION_MS: "1000", AI_PRESUPUESTO_MENSUAL: "1000000",
  AI_COSTO_MAXIMO_LLAMADA: "1", AI_TARIFA_ENTRADA_MTOK: "1", AI_TARIFA_SALIDA_MTOK: "2"
});

const mongoose = require("mongoose");
const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor, registrarDocente } = require("./cliente");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");

const prueba = pruebasConBase("modoTematicaHttp", { sql: true, mongo: true });
const llamar = conServidor();

const ejercicio = (n) => ({
  id: `e${n}`, consigna: `¿Con qué vocal empieza esta palabra? (${n})`, recursoId: "abeja",
  opciones: ["a", "e", "i"].map((t) => ({ id: t, texto: t })), respuestaCorrectaId: "a"
});

async function escenario() {
  await crearAsegurarCanales().ejecutar();
  const docente = await registrarDocente(llamar);
  const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } })).cuerpo.id;
  const estudiante = (await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { cursoId: curso, codigoLista: "A01", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
  return { docente, curso, estudiante };
}

describe("HTTP: modo de temática y compatibilidad (paso 3)", () => {
  prueba("una actividad guardada antes del cambio (sin modoTematica) se abre, se aprueba y se juega", async () => {
    const { docente, curso, estudiante } = await escenario();
    const juego = (await llamar("/api/juegos", { metodo: "POST", docente, cuerpo: { cursoId: curso, titulo: "Las vocales", habilidad: "vocales" } })).cuerpo.id;
    const rutaV = `/api/juegos/${juego}/versiones`;
    const version = (await llamar(rutaV, { metodo: "POST", docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: [1, 2, 3, 4, 5].map(ejercicio) } })).cuerpo;
    assert.equal(version.configuracion.modoTematica, "catalogo", "una versión nueva del catálogo lo declara");

    // Se deja el documento como lo guardaba la versión anterior
    const { modifiedCount } = await mongoose.connection.collection("versionesJuego").updateMany({}, { $unset: { "configuracion.modoTematica": "" } });
    assert.ok(modifiedCount >= 1);

    const abierta = await llamar(`${rutaV}/${version.id}`, { docente });
    assert.equal(abierta.status, 200);
    assert.equal(abierta.cuerpo.configuracion.modoTematica, "catalogo");
    assert.equal(abierta.cuerpo.configuracion.tematica, "animales");
    assert.equal((await llamar(`${rutaV}/${version.id}/aprobar`, { metodo: "POST", docente })).status, 200);

    const partida = await llamar("/api/partidas", { metodo: "POST", docente, cuerpo: { estudianteId: estudiante, juegoId: juego, canal: "aula_computador" } });
    assert.equal(partida.status, 201, JSON.stringify(partida.cuerpo));
    const jugable = (await llamar(`/api/partidas/${partida.cuerpo.id}/jugable`, { docente })).cuerpo;
    assert.equal(jugable.ejercicios.length, 5);
    const intento = await llamar(`/api/partidas/${partida.cuerpo.id}/intentos`, { metodo: "POST", docente, cuerpo: { ejercicioId: "e1", eleccion: "a", operacionId: "op-antigua-1" } });
    assert.equal(intento.status, 200, JSON.stringify(intento.cuerpo));
    assert.equal(intento.cuerpo.esCorrecto, true, "el servidor sigue corrigiendo con la versión antigua");
  });

  prueba("(a) la generación en modo catálogo funciona igual, con o sin modoTematica", async () => {
    const { docente, curso, estudiante } = await escenario();
    const datos = { cursoId: curso, estudianteId: estudiante, habilidad: "vocales", tematica: "animales", cantidad: 5 };
    const sin = await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: datos, cabeceras: { "idempotency-key": "clave-modo-sin-0000001" } });
    const con = await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: { ...datos, modoTematica: "catalogo" }, cabeceras: { "idempotency-key": "clave-modo-con-0000001" } });
    for (const r of [sin, con]) {
      assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
      assert.equal(r.cuerpo.estado, "completada");
      assert.deepEqual([r.cuerpo.parametros.modoTematica, r.cuerpo.parametros.tematica], ["catalogo", "animales"]);
      const versiones = (await llamar(`/api/juegos/${r.cuerpo.juegoId}/versiones`, { docente })).cuerpo;
      assert.equal(versiones[0].configuracion.modoTematica, "catalogo");
      assert.equal(versiones[0].ejercicios.length, 5);
    }
  });

  prueba("con el interruptor de la temática libre apagado (por defecto) se rechaza (503) sin guardar nada ni gastar cupo", async () => {
    const { docente, curso } = await escenario();
    const libre = { cursoId: curso, habilidad: "vocales", modoTematica: "libre", tematica: "sonidos de animales", cantidad: 5 };
    const r = await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: libre, cabeceras: { "idempotency-key": "clave-modo-libre-000001" } });
    assert.equal(r.status, 503, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.codigo, "GENERACION_LIBRE_DESHABILITADA");
    assert.deepEqual((await llamar("/api/generaciones", { docente })).cuerpo, []);
    const cuotas = (await llamar("/api/cuotas", { docente })).cuerpo;
    assert.equal((cuotas.diaria?.consumido || 0) + (cuotas.diaria?.reservado || 0), 0);
  });

  prueba("GET /api/cuotas informa que la temática libre NO está habilitada (interruptor apagado)", async () => {
    const { docente } = await escenario();
    const cuotas = (await llamar("/api/cuotas", { docente })).cuerpo;
    assert.deepEqual([cuotas.generacionHabilitada, cuotas.generacionLibreHabilitada], [true, false]);
  });

  prueba("un modo desconocido es un error de datos (400), no una temática del catálogo", async () => {
    const { docente, curso } = await escenario();
    const r = await llamar("/api/generaciones", {
      metodo: "POST", docente, cabeceras: { "idempotency-key": "clave-modo-raro-0000001" },
      cuerpo: { cursoId: curso, habilidad: "vocales", modoTematica: "otro", tematica: "animales", cantidad: 5 }
    });
    assert.equal(r.status, 400);
  });
});

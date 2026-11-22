const { describe } = require("node:test");
const assert = require("node:assert/strict");

// La generación se habilita ANTES de que buildApp lea el entorno (lo hace al registrar el módulo).
// Valores de prueba: con el generador falso no hay proveedor, tokens ni costo real.
Object.assign(process.env, {
  AI_ENABLED: "true", AI_PROVEEDOR: "falso", AI_MAX_DIARIAS: "3", AI_MAX_SIMULTANEAS: "1",
  AI_TIEMPO_LIMITE_MS: "5000", AI_MARGEN_CONCILIACION_MS: "1000", AI_PRESUPUESTO_MENSUAL: "1000000",
  AI_COSTO_MAXIMO_LLAMADA: "1", AI_TARIFA_ENTRADA_MTOK: "1", AI_TARIFA_SALIDA_MTOK: "2"
});

const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor, registrarDocente } = require("./cliente");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");

const prueba = pruebasConBase("generacionHttp", { sql: true, mongo: true });
const llamar = conServidor();

describe("HTTP: generación con IA (generador falso) de la solicitud a la partida", () => {
  prueba("solicitar, revisar el borrador, aprobarlo y jugarlo sin volver a gastar cupo", async () => {
    await crearAsegurarCanales().ejecutar();
    const docente = await registrarDocente(llamar);
    const ajeno = await registrarDocente(llamar);
    const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } })).cuerpo.id;
    const estudiante = (await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { cursoId: curso, codigoLista: "A01", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
    const datos = { cursoId: curso, estudianteId: estudiante, habilidad: "vocales", tematica: "animales", cantidad: 5, instruccion: "Animales de la granja" };
    const clave = { "idempotency-key": "clave-http-generacion-01" };

    const creada = await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: datos, cabeceras: clave });
    assert.equal(creada.status, 201, JSON.stringify(creada.cuerpo));
    assert.equal(creada.cuerpo.estado, "completada");
    assert.ok(creada.cuerpo.juegoId);
    assert.equal(creada.cuerpo.proveedor, "falso");
    const repetida = await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: datos, cabeceras: clave });
    assert.equal(repetida.status, 200);
    assert.equal(repetida.cuerpo.id, creada.cuerpo.id);

    // Borrador de origen IA, en la biblioteca del docente y de nadie más
    const juegoId = creada.cuerpo.juegoId;
    const juego = (await llamar(`/api/juegos/${juegoId}`, { docente })).cuerpo;
    assert.deepEqual([juego.origen, juego.estado, juego.generacionId], ["ia", "borrador", creada.cuerpo.id]);
    assert.equal((await llamar(`/api/juegos/${juegoId}`, { docente: ajeno })).status, 404);
    const versiones = (await llamar(`/api/juegos/${juegoId}/versiones`, { docente })).cuerpo;
    assert.equal(versiones.length, 1);
    assert.equal(versiones[0].estado, "borrador");
    assert.equal(versiones[0].ejercicios.length, 5);

    // La aprobación del docente es obligatoria: sin ella no se juega
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente, cuerpo: { estudianteId: estudiante, juegoId, canal: "aula_computador" } })).status, 409);
    const aprobada = await llamar(`/api/juegos/${juegoId}/versiones/${versiones[0].id}/aprobar`, { metodo: "POST", docente });
    assert.equal(aprobada.status, 200, JSON.stringify(aprobada.cuerpo));
    assert.equal(aprobada.cuerpo.juego.estado, "listo");

    // Jugar la actividad aprobada: el servidor corrige y no se gasta cupo
    const partida = await llamar("/api/partidas", { metodo: "POST", docente, cuerpo: { estudianteId: estudiante, juegoId, canal: "aula_computador" } });
    assert.equal(partida.status, 201);
    const jugable = (await llamar(`/api/partidas/${partida.cuerpo.id}/jugable`, { docente })).cuerpo;
    assert.equal(jugable.ejercicios.length, 5);
    assert.ok(!JSON.stringify(jugable).includes("respuestaCorrectaId"), "la vista jugable no revela la respuesta");
    const e1 = versiones[0].ejercicios[0];
    const intento = await llamar(`/api/partidas/${partida.cuerpo.id}/intentos`, {
      metodo: "POST", docente, cuerpo: { ejercicioId: e1.id, eleccion: e1.respuestaCorrectaId, operacionId: "op-ia-1" }
    });
    assert.equal(intento.cuerpo.esCorrecto, true);
    assert.equal((await llamar("/api/cuotas", { docente })).cuerpo.diaria.consumido, 1, "jugar no consume cupo de IA");
    const cuotas = (await llamar("/api/cuotas", { docente })).cuerpo;
    assert.equal(cuotas.limiteDiario, 3, "informa el límite diario configurado");
    assert.equal(cuotas.generacionHabilitada, true);
    assert.match(cuotas.dia, /^\d{4}-\d{2}-\d{2}$/);
  });

  prueba("el cupo diario se aplica por HTTP con el código que muestra la pantalla", async () => {
    await crearAsegurarCanales().ejecutar();
    const docente = await registrarDocente(llamar);
    const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { grado: "1.º EGB", paralelo: "B", anioLectivo: "2026-2027" } })).cuerpo.id;
    const pedir = (n, extra = {}) => llamar("/api/generaciones", {
      metodo: "POST", docente, cabeceras: { "idempotency-key": `clave-http-cupo-${String(n).padStart(4, "0")}` },
      cuerpo: { cursoId: curso, habilidad: "palabras_silabas", tematica: "objetos_cotidianos", cantidad: 5, ...extra }
    });

    for (const n of [1, 2, 3]) assert.equal((await pedir(n)).cuerpo.estado, "completada");
    const cuarta = await pedir(4);
    assert.equal(cuarta.status, 429);
    assert.equal(cuarta.cuerpo.codigo, "CUPO_DIARIO_AGOTADO");
    assert.match(cuarta.cuerpo.message, /hoy/);
    assert.equal((await llamar("/api/cuotas", { docente })).cuerpo.diaria.consumido, 3);
    assert.equal((await llamar("/api/generaciones?estado=completada", { docente })).cuerpo.length, 3);
    assert.equal((await pedir(5, { cantidad: 7 })).status, 400, "los parámetros siguen validándose");
  });
});

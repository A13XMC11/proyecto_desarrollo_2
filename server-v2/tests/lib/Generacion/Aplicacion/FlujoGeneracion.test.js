const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const { crearEscenario } = require("../../../Infraestructura/database/fixturesSql");
const { componer } = require("../../../../src/lib/Generacion/Infraestructura/http");
const ConfiguracionGeneracion = require("../../../../src/lib/Generacion/Dominio/Entidades/ConfiguracionGeneracion");
const Generacion = require("../../../../src/lib/Generacion/Dominio/Entidades/Generacion");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const CanalRepositoryMongoose = require("../../../../src/lib/Canal/Infraestructura/CanalRepositoryMongoose");
const EstudianteRepositorySequelize = require("../../../../src/lib/Aula/Infraestructura/EstudianteRepositorySequelize");
const CursoRepositorySequelize = require("../../../../src/lib/Aula/Infraestructura/CursoRepositorySequelize");
const { crearAsegurarCanales } = require("../../../../src/lib/Canal/Infraestructura/http");

// Flujo completo contra PostgreSQL y MongoDB reales; solo el generador es de prueba (no hay proveedor ni costo).
const prueba = pruebasConBase("FlujoGeneracion", { sql: true, mongo: true });
const falso = new GeneradorContenidoFalso();

// Tarifas 1 y 2 por millón de tokens: 200 000 + 100 000 tokens cuestan 0.4; 500 000 + 250 000, exactamente 1
const usoDe = (tokensEntrada, tokensSalida) => ({ proveedor: "prueba", modelo: "modelo-1", tokensEntrada, tokensSalida });
const conUso = (entrada = 200000, salida = 100000) => async (s) => ({ ...(await falso.generar(s)), uso: usoDe(entrada, salida) });
const contado = (generar) => {
  const g = { llamadas: 0, generar: async (...a) => { g.llamadas += 1; return generar(...a); } };
  return g;
};
const invalido = async (s) => {
  const r = await conUso()(s);
  return { ...r, ejercicios: r.ejercicios.map((e, i) => (i === 0 ? { ...e, recursoId: "fantasma" } : e)) };
};

const config = (extra = {}) => new ConfiguracionGeneracion({
  habilitada: true, tiempoLimiteMs: 150, margenConciliacionMs: 0,
  presupuestoMensual: 1e6, costoMaximoLlamada: 1, tarifaEntrada: 1, tarifaSalida: 2, ...extra
});
const montar = (generar, extra) => componer({ config: config(extra), generador: { generar } });

let contador = 0;
const clave = () => `clave-flujo-${String(++contador).padStart(8, "0")}`;
const datosDe = (esc, extra = {}) => ({
  cursoId: esc.cursoId, estudianteId: esc.estudianteId, habilidad: "vocales", tematica: "animales", cantidad: 5, instruccion: "Animales de la granja", ...extra
});
const escenario = async () => {
  await crearAsegurarCanales().ejecutar();
  return crearEscenario();
};

const { periodoDiario, periodoMensual } = require("../../../../src/lib/Generacion/Dominio/Entidades/Periodo");
// Mismo día calendario que usa el servidor (zona horaria configurada), no el día en UTC
const hoy = () => periodoDiario(new Date(), config().zonaHoraria);
const mes = () => periodoMensual(new Date(), config().zonaHoraria);
const sinCuota = { reservado: 0, consumido: 0 };
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} no es ${b}`);
const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const esperar = async (condicion) => {
  for (let i = 0; i < 600 && !condicion(); i += 1) await dormir(5);
  assert.ok(condicion(), "la condición no se cumplió a tiempo");
};
const enUnaHora = () => new Date(Date.now() + 3600_000);

const diaria = async (c, docenteId) => (await c.cuotaRepo.obtener(docenteId, hoy())) || sinCuota;
const global = async (c) => (await c.cuotaRepo.obtener(undefined, mes())) || sinCuota;
const usadoGlobal = async (c) => { const g = await global(c); return g.reservado + g.consumido; };

// Una generación "pendiente" con su reserva hecha, como si el servidor hubiera caído antes de llamar al proveedor
async function generacionConReserva(c, esc, extra = {}) {
  const canal = await new CanalRepositoryMongoose().findByCodigo("docente_computador");
  const { generacion } = await c.repo.save(new Generacion({
    docenteId: esc.docenteId, canalId: canal.id, claveSolicitud: clave(),
    parametros: { cursoId: esc.cursoId, estudianteId: esc.estudianteId, habilidad: "vocales", tematica: "animales", cantidad: 5, ...extra }
  }));
  return c.reservarCupo.ejecutar(generacion);
}

describe("Flujo de generación: éxito, idempotencia y errores previos al proveedor", () => {
  prueba("completa el flujo: borrador de origen IA, versión válida, uso registrado y consumo real", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const antes = await global(c);

    const { generacion, esNueva } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.equal(esNueva, true);
    assert.equal(generacion.estado, "completada");
    assert.equal(generacion.usoDesconocido, false);
    assert.deepEqual([generacion.proveedor, generacion.modelo, generacion.tokensEntrada, generacion.tokensSalida], ["prueba", "modelo-1", 200000, 100000]);
    assert.equal(generacion.reserva.liberada, true, "la reserva quedó resuelta");

    const juego = await c.juegoRepo.findById(generacion.juegoId, esc.docenteId);
    assert.deepEqual([juego.origen, juego.estado, juego.generacionId, juego.cursoId, juego.estudianteId], ["ia", "borrador", generacion.id, esc.cursoId, esc.estudianteId]);
    assert.equal(juego.habilidad, "vocales");
    const versiones = await c.versionRepo.findByJuego(juego.id);
    assert.equal(versiones.length, 1);
    assert.deepEqual([versiones[0].numero, versiones[0].estado, versiones[0].ejercicios.length], [1, "borrador", 5]);

    const d = await diaria(c, esc.docenteId);
    assert.deepEqual([d.reservado, d.consumido], [0, 1]);
    const g = await global(c);
    cerca(g.reservado, antes.reservado);
    cerca(g.consumido - antes.consumido, 0.4);
  });

  prueba("también genera actividades de sílabas", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc, { habilidad: "palabras_silabas", tematica: "naturaleza" }));
    assert.equal(generacion.estado, "completada");
    const juego = await c.juegoRepo.findById(generacion.juegoId, esc.docenteId);
    assert.equal(juego.mecanica, "ordenar_silabas");
    assert.equal((await c.versionRepo.findByJuego(juego.id))[0].configuracion.tematica, "naturaleza");
  });

  prueba("el generador no recibe nada que identifique al docente ni al estudiante", async () => {
    const esc = await escenario();
    let recibida;
    const c = montar(async (s) => { recibida = s; return conUso()(s); });
    await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.deepEqual(Object.keys(recibida).sort(), ["cantidad", "franjaEdad", "habilidad", "instruccion", "mecanica", "modoTematica", "recursos", "tematica"]);
    assert.equal(recibida.franjaEdad, 6);
    assert.ok(!JSON.stringify(recibida).includes(esc.docenteId) && !JSON.stringify(recibida).includes(esc.estudianteId));
  });

  prueba("repetir la clave devuelve la original sin llamar al generador ni gastar cupo; con otros datos es un conflicto", async () => {
    const esc = await escenario();
    const gen = contado(conUso());
    const c = montar(gen.generar);
    const k = clave();
    const primera = await c.solicitar.ejecutar(esc.docenteId, k, datosDe(esc));
    const repetida = await c.solicitar.ejecutar(esc.docenteId, k, datosDe(esc));
    assert.equal(repetida.esNueva, false);
    assert.equal(repetida.generacion.id, primera.generacion.id);
    assert.equal(gen.llamadas, 1);
    assert.equal((await diaria(c, esc.docenteId)).consumido, 1);
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, k, datosDe(esc, { tematica: "naturaleza" })), (e) => e.codigo === "CLAVE_REUTILIZADA");
    assert.equal(gen.llamadas, 1);
  });

  prueba("con la generación apagada se rechaza sin llamar al generador ni reservar nada", async () => {
    const esc = await escenario();
    const gen = contado(conUso());
    const c = montar(gen.generar, { habilitada: false });
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), (e) => e.statusCode === 503 && e.codigo === "GENERACION_DESHABILITADA");
    const [g] = await c.repo.findByDocente(esc.docenteId);
    assert.deepEqual([g.estado, g.errorCodigo, g.reserva], ["fallida", "GENERACION_DESHABILITADA", undefined]);
    assert.equal(gen.llamadas, 0);
    assert.equal(await c.cuotaRepo.obtener(esc.docenteId, hoy()), null);
  });

  prueba("rechaza curso o estudiante archivados y 10 ejercicios mientras no estén habilitados", async () => {
    const esc = await escenario();
    const gen = contado(conUso());
    const c = montar(gen.generar);
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc, { cantidad: 10 })), /10 ejercicios/);
    await new EstudianteRepositorySequelize().update(esc.estudianteId, esc.docenteId, { archivado: true });
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), (e) => e.codigo === "ESTUDIANTE_ARCHIVADO");
    await new CursoRepositorySequelize().update(esc.cursoId, esc.docenteId, { archivado: true });
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc, { estudianteId: undefined })), (e) => e.codigo === "CURSO_ARCHIVADO");
    assert.equal(gen.llamadas, 0);
  });
});

describe("Flujo de generación: cupo y presupuesto", () => {
  prueba("el cupo diario se agota; la solicitud rechazada no llama al generador ni deja reservas", async () => {
    const esc = await escenario();
    const gen = contado(conUso());
    const c = montar(gen.generar, { maxDiarias: 2 });
    const antes = await global(c);
    for (let i = 0; i < 2; i += 1) assert.equal((await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc))).generacion.estado, "completada");
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), (e) => e.statusCode === 429 && e.codigo === "CUPO_DIARIO_AGOTADO");

    assert.equal(gen.llamadas, 2);
    const d = await diaria(c, esc.docenteId);
    assert.deepEqual([d.reservado, d.consumido], [0, 2]);
    const g = await global(c);
    cerca(g.reservado, antes.reservado);
    cerca(g.consumido - antes.consumido, 0.8);
    const [rechazada] = await c.repo.findByDocente(esc.docenteId, { estado: "fallida" });
    assert.equal(rechazada.errorCodigo, "CUPO_DIARIO_AGOTADO");
  });

  prueba("sin presupuesto global se rechaza y se devuelve el cupo diario ya reservado", async () => {
    const esc = await escenario();
    const gen = contado(conUso());
    const base = await usadoGlobal(montar(gen.generar));
    const c = montar(gen.generar, { presupuestoMensual: base + 1 });

    assert.equal((await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc))).generacion.estado, "completada");
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), (e) => e.statusCode === 429 && e.codigo === "PRESUPUESTO_AGOTADO");
    assert.equal(gen.llamadas, 1);
    const d = await diaria(c, esc.docenteId);
    assert.deepEqual([d.reservado, d.consumido], [0, 1], "la reserva diaria de la solicitud rechazada se devolvió");
  });

  prueba("con peticiones concurrentes no se supera el presupuesto", async () => {
    const escenarios = await Promise.all([1, 2, 3, 4, 5].map(escenario));
    const gen = contado(conUso(500000, 250000)); // cada llamada cuesta exactamente 1
    const base = await usadoGlobal(montar(gen.generar));
    const c = montar(gen.generar, { presupuestoMensual: base + 2 });

    const resultados = await Promise.allSettled(escenarios.map((e) => c.solicitar.ejecutar(e.docenteId, clave(), datosDe(e))));
    const cumplidas = resultados.filter((r) => r.status === "fulfilled");
    const rechazadas = resultados.filter((r) => r.status === "rejected");
    assert.equal(cumplidas.length, 2);
    assert.ok(rechazadas.every((r) => r.reason.codigo === "PRESUPUESTO_AGOTADO"));
    assert.equal(gen.llamadas, 2, "solo dos solicitudes llegaron al proveedor");
    cerca((await usadoGlobal(c)) - base, 2);
  });

  prueba("una segunda solicitud mientras otra se procesa se rechaza (una por docente)", async () => {
    const esc = await escenario();
    let abrir;
    const puerta = new Promise((resolver) => { abrir = resolver; });
    const gen = contado(async (s) => { await puerta; return conUso()(s); });
    const c = montar(gen.generar, { tiempoLimiteMs: 5000 });

    const primera = c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    await esperar(() => gen.llamadas === 1);
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), (e) => e.statusCode === 429 && e.codigo === "GENERACION_EN_CURSO");
    abrir();
    assert.equal((await primera).generacion.estado, "completada");
    assert.equal(gen.llamadas, 1);
    const d = await diaria(c, esc.docenteId);
    assert.deepEqual([d.reservado, d.consumido], [0, 1]);
  });
});

describe("Flujo de generación: fallos después de reservar", () => {
  prueba("contenido inválido: no llega a ningún estudiante, no hay borrador y el consumo conocido se registra", async () => {
    const esc = await escenario();
    const c = montar(invalido);
    const antes = await global(c);
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));

    assert.deepEqual([generacion.estado, generacion.errorCodigo, generacion.juegoId], ["fallida", "CONTENIDO_INVALIDO", undefined]);
    assert.equal(await c.juegoRepo.findByGeneracionId(generacion.id, esc.docenteId), null);
    assert.equal((await c.juegoRepo.findPaginado(esc.docenteId)).total, 0);
    const d = await diaria(c, esc.docenteId);
    assert.deepEqual([d.reservado, d.consumido], [0, 1], "pudo haber costo: el cupo queda consumido");
    cerca((await global(c)).consumido - antes.consumido, 0.4);
  });

  prueba("tiempo agotado: consumo desconocido, cupo diario consumido y reserva global mantenida", async () => {
    const esc = await escenario();
    const c = montar(() => new Promise(() => {}), { tiempoLimiteMs: 60 });
    const antes = await global(c);
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));

    assert.deepEqual([generacion.estado, generacion.errorCodigo, generacion.usoDesconocido], ["fallida", "GENERADOR_TIEMPO_AGOTADO", true]);
    const d = await diaria(c, esc.docenteId);
    assert.deepEqual([d.reservado, d.consumido], [0, 1]);
    const g = await global(c);
    cerca(g.reservado - antes.reservado, 1);
    cerca(g.consumido - antes.consumido, 0);
    assert.equal(generacion.reserva.liberada, false, "queda pendiente de conciliar con el proveedor");
  });

  prueba("error del generador: igual que un tiempo agotado, sin romper el servidor aunque falle tarde", async () => {
    const esc = await escenario();
    const tardeYMal = async () => { await dormir(150); throw new Error("fallo tardío"); };
    const c = montar(tardeYMal, { tiempoLimiteMs: 40 });
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.equal(generacion.errorCodigo, "GENERADOR_TIEMPO_AGOTADO");
    await dormir(250); // el rechazo tardío no debe producir un error sin manejar

    const roto = montar(async () => { throw new Error("proveedor caído"); });
    const esc2 = await escenario();
    const { generacion: g2 } = await roto.solicitar.ejecutar(esc2.docenteId, clave(), datosDe(esc2));
    assert.deepEqual([g2.estado, g2.errorCodigo, g2.usoDesconocido], ["fallida", "GENERADOR_ERROR", true]);
    assert.equal((await diaria(roto, esc2.docenteId)).consumido, 1);
  });

  prueba("sin tokens informados el consumo es desconocido y se conserva la reserva (no se registra como cero)", async () => {
    const esc = await escenario();
    const c = montar(async (s) => ({ ...(await falso.generar(s)), uso: { proveedor: "prueba", modelo: "modelo-1" } }));
    const antes = await global(c);
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.deepEqual([generacion.estado, generacion.usoDesconocido], ["completada", true]);
    assert.equal(generacion.tokensEntrada, undefined);
    cerca((await global(c)).reservado - antes.reservado, 1);
  });
});

describe("Cancelación y conciliación", () => {
  prueba("cancelar una generación que aún no llamó al proveedor devuelve su reserva", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const antes = await global(c);
    const g = await generacionConReserva(c, esc);
    assert.equal((await diaria(c, esc.docenteId)).reservado, 1);

    const cancelada = await c.cancelar.ejecutar(esc.docenteId, g.id);
    assert.deepEqual([cancelada.estado, cancelada.errorCodigo], ["fallida", "CANCELADA_POR_DOCENTE"]);
    assert.equal((await diaria(c, esc.docenteId)).reservado, 0);
    cerca((await global(c)).reservado, antes.reservado);
  });

  prueba("cancelar una generación que ya estaba llamando al proveedor mantiene el cupo", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const g = await generacionConReserva(c, esc);
    await c.repo.marcarProcesando(g.id, esc.docenteId);
    await c.cancelar.ejecutar(esc.docenteId, g.id);
    assert.equal((await diaria(c, esc.docenteId)).reservado, 1);
  });

  prueba("una generación procesando que venció se interrumpe con consumo desconocido y conserva la reserva", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const antes = await global(c);
    const g = await generacionConReserva(c, esc);
    await c.repo.marcarProcesando(g.id, esc.docenteId);

    assert.deepEqual(await c.conciliar.ejecutar({ docenteId: esc.docenteId, ahora: enUnaHora() }), { completadas: 0, interrumpidas: 1 });
    const final = await c.repo.findById(g.id, esc.docenteId);
    assert.deepEqual([final.estado, final.usoDesconocido], ["interrumpida", true]);
    assert.equal((await diaria(c, esc.docenteId)).reservado, 1);
    cerca((await global(c)).reservado - antes.reservado, 1);
    assert.deepEqual(await c.conciliar.ejecutar({ docenteId: esc.docenteId, ahora: enUnaHora() }), { completadas: 0, interrumpidas: 0 }, "idempotente");
  });

  prueba("una generación pendiente que venció nunca llamó al proveedor: se interrumpe y devuelve la reserva", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const antes = await global(c);
    const g = await generacionConReserva(c, esc);
    await c.conciliar.ejecutar({ docenteId: esc.docenteId, ahora: enUnaHora() });

    const final = await c.repo.findById(g.id, esc.docenteId);
    assert.deepEqual([final.estado, final.usoDesconocido], ["interrumpida", false]);
    assert.equal((await diaria(c, esc.docenteId)).reservado, 0);
    cerca((await global(c)).reservado, antes.reservado);
  });

  prueba("una caída entre guardar el borrador y cerrar la generación se concilia sin duplicar el borrador", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const original = c.repo.marcarCompletada.bind(c.repo);
    let cae = true;
    c.repo.marcarCompletada = async (...args) => {
      if (cae) { cae = false; throw new Error("caída del servidor"); }
      return original(...args);
    };
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), /caída del servidor/);
    const [atascada] = await c.repo.findByDocente(esc.docenteId);
    assert.equal(atascada.estado, "procesando");
    const juego = await c.juegoRepo.findByGeneracionId(atascada.id, esc.docenteId);
    assert.ok(juego, "el borrador ya se había guardado");

    assert.deepEqual(await c.conciliar.ejecutar({ docenteId: esc.docenteId, ahora: enUnaHora() }), { completadas: 1, interrumpidas: 0 });
    const final = await c.repo.findById(atascada.id, esc.docenteId);
    assert.deepEqual([final.estado, final.juegoId], ["completada", juego.id]);
    assert.equal((await c.juegoRepo.findPaginado(esc.docenteId)).total, 1);
    assert.equal((await c.versionRepo.findByJuego(juego.id)).length, 1);
    assert.deepEqual(await c.conciliar.ejecutar({ docenteId: esc.docenteId, ahora: enUnaHora() }), { completadas: 0, interrumpidas: 0 });
  });

  prueba("una generación dentro del tiempo permitido no se toca, y la conciliación respeta al docente", async () => {
    const a = await escenario();
    const b = await escenario();
    const c = montar(conUso());
    const ga = await generacionConReserva(c, a);
    const gb = await generacionConReserva(c, b);
    await c.repo.marcarProcesando(ga.id, a.docenteId);
    await c.repo.marcarProcesando(gb.id, b.docenteId);

    assert.deepEqual(await c.conciliar.ejecutar({ ahora: new Date() }), { completadas: 0, interrumpidas: 0 }, "aún no vence");
    assert.deepEqual(await c.conciliar.ejecutar({ docenteId: a.docenteId, ahora: enUnaHora() }), { completadas: 0, interrumpidas: 1 });
    assert.equal((await c.repo.findById(ga.id, a.docenteId)).estado, "interrumpida");
    assert.equal((await c.repo.findById(gb.id, b.docenteId)).estado, "procesando", "la de otro docente no se tocó");
  });

  prueba("no concilia con la generación apagada", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const g = await generacionConReserva(c, esc);
    const apagado = montar(conUso(), { habilitada: false });
    assert.deepEqual(await apagado.conciliar.ejecutar({ ahora: enUnaHora() }), { completadas: 0, interrumpidas: 0 });
    assert.equal((await c.repo.findById(g.id, esc.docenteId)).estado, "pendiente");
  });

  prueba("consultar una generación concilia las vencidas del docente (de forma diferida)", async () => {
    const esc = await escenario();
    const c = montar(conUso(), { tiempoLimiteMs: 50 });
    const g = await generacionConReserva(c, esc);
    await c.repo.marcarProcesando(g.id, esc.docenteId);
    assert.equal((await c.obtener.ejecutar(esc.docenteId, g.id)).estado, "procesando", "aún dentro del tiempo");
    await dormir(120);
    assert.equal((await c.obtener.ejecutar(esc.docenteId, g.id)).estado, "interrumpida");
    assert.equal((await c.listar.ejecutar(esc.docenteId, { estado: "interrumpida" })).length, 1);
  });
});

// Regresiones de la revisión de código: cada prueba reproduce un escenario que habría perdido o duplicado cupo.
describe("Correcciones de la revisión de código", () => {
  const sinRuido = async (accion) => {
    const original = console.error;
    console.error = () => {};
    try { return await accion(); } finally { console.error = original; }
  };

  prueba("cancelar no devuelve la reserva si la generación pasó a 'procesando' después de leerla", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const g = await generacionConReserva(c, esc);
    // La carrera: el docente lee "pendiente", pero otra petición empieza la llamada antes de que cancele
    const leer = c.repo.findById.bind(c.repo);
    c.repo.findById = async (...args) => {
      const leida = await leer(...args);
      c.repo.findById = leer;
      await c.repo.marcarProcesando(g.id, esc.docenteId);
      return leida;
    };
    await c.cancelar.ejecutar(esc.docenteId, g.id);
    assert.equal((await diaria(c, esc.docenteId)).reservado, 1, "la llamada está en curso: el cupo no se devuelve");
  });

  prueba("conciliar no devuelve la reserva de una generación que empezó a llamar tras listarla como pendiente", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const antes = await global(c);
    const g = await generacionConReserva(c, esc);
    const listar = c.repo.findVencidas.bind(c.repo);
    c.repo.findVencidas = async (...args) => {
      const lote = await listar(...args);
      for (const v of lote) await c.repo.marcarProcesando(v.id, v.docenteId);
      return lote;
    };
    await c.conciliar.ejecutar({ docenteId: esc.docenteId, ahora: enUnaHora() });
    const final = await c.repo.findById(g.id, esc.docenteId);
    assert.deepEqual([final.estado, final.usoDesconocido], ["interrumpida", true]);
    assert.equal((await diaria(c, esc.docenteId)).reservado, 1);
    cerca((await global(c)).reservado - antes.reservado, 1);
  });

  prueba("una excepción a mitad de la reserva devuelve lo ya reservado", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const antes = await global(c);
    const reservar = c.cuotaRepo.reservar.bind(c.cuotaRepo);
    let llamadas = 0;
    c.cuotaRepo.reservar = async (datos) => {
      llamadas += 1;
      if (llamadas === 2) throw new Error("corte de conexión");
      return reservar(datos);
    };
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), /corte de conexión/);
    assert.deepEqual([(await diaria(c, esc.docenteId)).reservado], [0], "el cupo diario no quedó colgado");

    // Y si falla el registro de la reserva, con las dos ya hechas, se devuelven ambas
    c.cuotaRepo.reservar = reservar;
    c.repo.registrarReserva = async () => { throw new Error("corte al registrar"); };
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), /corte al registrar/);
    assert.equal((await diaria(c, esc.docenteId)).reservado, 0);
    cerca((await global(c)).reservado, antes.reservado);
  });

  prueba("si falla preparar la solicitud no se cobra como llamada: la reserva vuelve y no se consume nada", async () => {
    const esc = await escenario();
    const gen = contado(conUso());
    const c = montar(gen.generar);
    const antes = await global(c);
    c.procesarGeneracion.catalogo.listar = () => { throw new Error("corte del catálogo"); };

    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)), /corte del catálogo/);
    const [g] = await c.repo.findByDocente(esc.docenteId);
    assert.deepEqual([g.estado, g.errorCodigo], ["fallida", "ERROR_AL_PREPARAR"]);
    assert.equal(gen.llamadas, 0);
    const d = await diaria(c, esc.docenteId);
    assert.deepEqual([d.reservado, d.consumido], [0, 0]);
    cerca((await global(c)).reservado, antes.reservado);
  });

  prueba("una generación pendiente colgada no bloquea las nuevas solicitudes del docente", async () => {
    const esc = await escenario();
    const c = montar(conUso(), { tiempoLimiteMs: 50 });
    const colgada = await generacionConReserva(c, esc);
    await dormir(120);

    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.equal(generacion.estado, "completada", "no devolvió GENERACION_EN_CURSO");
    assert.equal((await c.repo.findById(colgada.id, esc.docenteId)).estado, "interrumpida");
  });

  prueba("un fallo al registrar el consumo no convierte una generación completada en error y deja la reserva pendiente", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    c.cuotaRepo.consumir = async () => { throw new Error("corte al consumir"); };
    const { generacion } = await sinRuido(() => c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc)));
    assert.equal(generacion.estado, "completada", "el docente recibe su actividad");
    assert.equal(generacion.reserva.liberada, false, "la reserva figura pendiente de conciliar, no saldada");
  });

  prueba("tokens negativos o no enteros se tratan como consumo desconocido, no se registran", async () => {
    const esc = await escenario();
    const c = montar(conUso(-5, 100));
    const antes = await global(c);
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.deepEqual([generacion.estado, generacion.usoDesconocido], ["completada", true]);
    cerca((await global(c)).reservado - antes.reservado, 1);
  });

  prueba("el borrador solo se oculta si el docente canceló; uno completado por la conciliación no se archiva", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    c.repo.marcarCompletada = async () => null; // la conciliación la completó antes (la generación sigue viva en la base)
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    const juego = await c.juegoRepo.findByGeneracionId(generacion.id, esc.docenteId);
    assert.equal(juego.estado, "borrador", "no se archivó");

    const esc2 = await escenario();
    const c2 = montar(conUso());
    c2.repo.marcarCompletada = async (id, docenteId) => { await c2.repo.marcarFallida(id, docenteId, "CANCELADA_POR_DOCENTE"); return null; };
    const { generacion: g2 } = await c2.solicitar.ejecutar(esc2.docenteId, clave(), datosDe(esc2));
    assert.equal((await c2.juegoRepo.findByGeneracionId(g2.id, esc2.docenteId)).estado, "archivado", "cancelada: el borrador no queda a la vista");
  });
});

// El generador real (GeneradorContenidoIA) de punta a punta; solo el transporte HTTP es simulado
describe("Flujo de generación con GeneradorContenidoIA (proveedor simulado)", () => {
  const GeneradorContenidoIA = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoIA");
  const catalogo = new (require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson"))();
  const OPCIONES = { a: ["e", "o"], e: ["i", "u"], i: ["a", "o"], o: ["a", "u"], u: ["e", "i"] };

  // Responde como el proveedor: elige recursos del enum del esquema que recibió
  const proveedor = (respuesta) => async (_url, { body }) => {
    const ids = JSON.parse(body).generationConfig.responseJsonSchema.properties.ejercicios.items.properties.recursoId.enum;
    return { ok: true, status: 200, json: async () => respuesta(ids) };
  };
  const valida = (ids) => ({
    candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({
      titulo: "Vocales con animales",
      ejercicios: ids.slice(0, 5).map((recursoId) => {
        const vocal = catalogo.obtenerRecurso(recursoId).vocalInicial;
        return { recursoId, consigna: "¿Con qué vocal empieza esta palabra?", vocalesOpciones: [vocal, ...OPCIONES[vocal]] };
      })
    }) }] } }],
    usageMetadata: { promptTokenCount: 200000, candidatesTokenCount: 60000, thoughtsTokenCount: 40000 }
  });
  const cortada = () => ({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{\"titulo\":" }] } }] });
  const cortadaConUso = () => ({ ...cortada(), usageMetadata: { promptTokenCount: 200000, candidatesTokenCount: 60000, thoughtsTokenCount: 40000 } });
  const montarIA = (respuesta) => componer({
    config: config(),
    generador: new GeneradorContenidoIA({ apiKey: "k", modelo: "modelo-gemini", maxTokensSalida: 1000, fetchFn: proveedor(respuesta) })
  });

  prueba("completa el flujo, registra proveedor y modelo, y suma el razonamiento a la salida", async () => {
    const esc = await escenario();
    const c = montarIA(valida);
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.equal(generacion.estado, "completada");
    assert.equal(generacion.usoDesconocido, false);
    assert.deepEqual([generacion.proveedor, generacion.modelo, generacion.tokensEntrada, generacion.tokensSalida], ["gemini", "modelo-gemini", 200000, 100000]);
    const juego = await c.juegoRepo.findById(generacion.juegoId, esc.docenteId);
    assert.deepEqual([juego.origen, juego.estado], ["ia", "borrador"]);
    assert.equal((await c.versionRepo.findByJuego(juego.id))[0].ejercicios.length, 5);
  });

  prueba("una respuesta cortada con uso informado se factura al costo real y no deja la reserva retenida", async () => {
    const esc = await escenario();
    const c = montarIA(cortadaConUso);
    const antes = await global(c);
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.deepEqual([generacion.estado, generacion.errorCodigo, generacion.usoDesconocido], ["fallida", "GENERADOR_RESPUESTA_INCOMPLETA", false]);
    assert.deepEqual([generacion.tokensEntrada, generacion.tokensSalida], [200000, 100000]);
    assert.equal(generacion.reserva.liberada, true);
    const g = await global(c);
    cerca(g.reservado, antes.reservado);
    cerca(g.consumido - antes.consumido, 0.4);
    assert.equal((await diaria(c, esc.docenteId)).consumido, 1);
  });

  prueba("una respuesta cortada por el tope de tokens falla con consumo desconocido y cupo consumido", async () => {
    const esc = await escenario();
    const c = montarIA(cortada);
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc));
    assert.deepEqual([generacion.estado, generacion.errorCodigo, generacion.usoDesconocido], ["fallida", "GENERADOR_RESPUESTA_INCOMPLETA", true]);
    assert.equal(generacion.juegoId, undefined, "no se guardó ningún borrador");
    assert.equal((await diaria(c, esc.docenteId)).consumido, 1, "pudo haber costo: el cupo diario queda consumido");
  });
});

describe("Flujo de generación: el día del cupo es el de la zona horaria configurada", () => {
  prueba("a las 21:00 en Ecuador (02:00 UTC del día siguiente) el cupo cuenta para el día local", async () => {
    const esc = await escenario();
    const c = montar(conUso());
    const canal = await new CanalRepositoryMongoose().findByCodigo("docente_computador");
    const { generacion } = await c.repo.save(new Generacion({
      docenteId: esc.docenteId, canalId: canal.id, claveSolicitud: clave(),
      parametros: { cursoId: esc.cursoId, estudianteId: esc.estudianteId, habilidad: "vocales", tematica: "animales", cantidad: 5 }
    }));
    const tarde = new Date("2026-11-23T02:00:00Z"); // 22 de noviembre, 21:00 en America/Guayaquil
    await c.reservarCupo.ejecutar(generacion, tarde);
    assert.equal((await c.cuotaRepo.obtener(esc.docenteId, "2026-11-22")).reservado, 1, "cuenta para el 22, el día local");
    assert.equal(await c.cuotaRepo.obtener(esc.docenteId, "2026-11-23"), null, "no para el 23 (UTC)");
  });

  prueba("una zona horaria inexistente se rechaza al configurar", () => {
    assert.throws(() => config({ zonaHoraria: "Marte/Olympus" }), /zona horaria inválida/);
  });
});

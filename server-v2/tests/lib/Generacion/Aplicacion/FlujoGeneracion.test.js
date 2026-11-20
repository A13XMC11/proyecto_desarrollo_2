const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Generacion = require("../../../../src/lib/Generacion/Dominio/Entidades/Generacion");
const SolicitarGeneracion = require("../../../../src/lib/Generacion/Aplicacion/SolicitarGeneracion");
const ProcesarGeneracion = require("../../../../src/lib/Generacion/Aplicacion/ProcesarGeneracion");
const ConciliarGeneraciones = require("../../../../src/lib/Generacion/Aplicacion/ConciliarGeneraciones");
const CancelarGeneracion = require("../../../../src/lib/Generacion/Aplicacion/CancelarGeneracion");
const LiquidarReserva = require("../../../../src/lib/Generacion/Aplicacion/LiquidarReserva");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const CatalogoRecursosJson = require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const LimiteAlcanzado = require("../../../../src/lib/Compartido/Dominio/Errores/LimiteAlcanzado");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const DOCENTE = "11111111-1111-4111-8111-111111111111";
const CURSO = "22222222-2222-4222-8222-222222222222";
const ACTIVOS = ["pendiente", "procesando"];
let secuencia = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++secuencia).padStart(12, "0")}`;
const objectId = () => String(++secuencia).padStart(24, "0");

// Repositorios en memoria que implementan los Ports de Generacion y de Juego
function generacionesEnMemoria() {
  const filas = new Map();
  const copia = (g) => (g ? new Generacion({ ...g, reserva: g.reserva && { ...g.reserva } }) : null);
  const transicion = (id, docenteId, desde, cambios) => {
    const g = filas.get(id);
    if (!g || g.docenteId !== docenteId || !desde.includes(g.estado)) return null;
    filas.set(id, copia({ ...g, ...cambios }));
    return copia(filas.get(id));
  };
  return {
    filas,
    async save(g) {
      const existente = [...filas.values()].find((f) => f.docenteId === g.docenteId && f.claveSolicitud === g.claveSolicitud);
      if (existente) return { generacion: copia(existente), esNueva: false };
      const nueva = copia({ ...g, id: uuid(), creadaEn: new Date() });
      filas.set(nueva.id, nueva);
      return { generacion: copia(nueva), esNueva: true };
    },
    async findById(id, docenteId) {
      const g = filas.get(id);
      return g && g.docenteId === docenteId ? copia(g) : null;
    },
    async findByDocente(docenteId) {
      return [...filas.values()].filter((g) => g.docenteId === docenteId).map(copia);
    },
    async findByClave(docenteId, clave) {
      return copia([...filas.values()].find((g) => g.docenteId === docenteId && g.claveSolicitud === clave));
    },
    async registrarReserva(id, docenteId, reserva) {
      return transicion(id, docenteId, ACTIVOS, { reserva: { ...reserva, liberada: false } });
    },
    async marcarReservaLiberada(id, docenteId) {
      const g = filas.get(id);
      if (!g || g.docenteId !== docenteId || !g.reserva || g.reserva.liberada) return null;
      filas.set(id, copia({ ...g, reserva: { ...g.reserva, liberada: true } }));
      return copia(filas.get(id));
    },
    marcarProcesando: (id, d) => transicion(id, d, ["pendiente"], { estado: "procesando" }),
    marcarCompletada: (id, d, juegoId, uso) => transicion(id, d, [...ACTIVOS, "interrumpida"], { ...uso, estado: "completada", juegoId }),
    marcarFallida: (id, d, errorCodigo, uso) => transicion(id, d, ACTIVOS, { ...uso, estado: "fallida", errorCodigo }),
    marcarInterrumpida: (id, d, uso) => transicion(id, d, ACTIVOS, { usoDesconocido: true, ...uso, estado: "interrumpida" }),
    async contarActivas(docenteId) {
      return [...filas.values()].filter((g) => g.docenteId === docenteId && ACTIVOS.includes(g.estado)).length;
    },
    async findVencidas(antesDe) {
      return [...filas.values()].filter((g) => ACTIVOS.includes(g.estado) && g.creadaEn < antesDe).map(copia);
    }
  };
}

function cuotasEnMemoria() {
  const filas = new Map();
  const porId = (id) => [...filas.values()].find((c) => c.id === id);
  return {
    filas,
    diaria: () => [...filas.values()].find((c) => c.docenteId),
    global: () => [...filas.values()].find((c) => !c.docenteId),
    async reservar({ docenteId, periodo, cantidad, limite }) {
      const clave = `${docenteId || "global"}|${periodo}`;
      if (!filas.has(clave)) filas.set(clave, { id: uuid(), docenteId, periodo, reservado: 0, consumido: 0 });
      const c = filas.get(clave);
      if (c.reservado + c.consumido + cantidad > limite) return { reservada: false, cuota: { ...c } };
      c.reservado += cantidad;
      return { reservada: true, cuota: { ...c } };
    },
    async liberar({ cuotaId, cantidad }) {
      const c = porId(cuotaId);
      if (!c || c.reservado < cantidad) return { liberada: false, cuota: null };
      c.reservado -= cantidad;
      return { liberada: true, cuota: { ...c } };
    },
    async consumir({ cuotaId, cantidad, real = cantidad }) {
      const c = porId(cuotaId);
      if (!c || c.reservado < cantidad) return { consumida: false, cuota: null };
      c.reservado -= cantidad;
      c.consumido += real;
      return { consumida: true, cuota: { ...c } };
    }
  };
}

function juegosEnMemoria() {
  const juegos = [];
  const versiones = [];
  return {
    juegos,
    versiones,
    juegoRepo: {
      async save(j) {
        const guardado = { ...j, id: objectId() };
        juegos.push(guardado);
        return guardado;
      },
      async findByGeneracionId(generacionId, docenteId) {
        return juegos.find((j) => j.generacionId === generacionId && j.docenteId === docenteId) || null;
      },
      async archivar(id) {
        const j = juegos.find((x) => x.id === id);
        if (j) j.estado = "archivado";
        return j || null;
      }
    },
    versionRepo: {
      async save(v) {
        const guardada = { ...v, id: objectId() };
        versiones.push(guardada);
        return guardada;
      },
      async findBorradorByJuego(juegoId) {
        return versiones.find((v) => v.juegoId === juegoId && v.estado === "borrador") || null;
      }
    }
  };
}

const catalogo = new CatalogoRecursosJson();
const cursos = { findById: async (id, docenteId) => (id === CURSO && docenteId === DOCENTE ? { id: CURSO, archivado: false } : null) };
const estudiantes = { findById: async () => null };
const canales = { findByCodigo: async (codigo) => (codigo === "docente_computador" ? { id: "c".repeat(24) } : null) };

function armar({ generador = new GeneradorContenidoFalso(), config = {}, tiempoLimiteMs = 1000, procesar } = {}) {
  const generaciones = generacionesEnMemoria();
  const cuotas = cuotasEnMemoria();
  const { juegos, versiones, juegoRepo, versionRepo } = juegosEnMemoria();
  const liquidarReserva = new LiquidarReserva(generaciones, cuotas);
  const conciliar = new ConciliarGeneraciones({ generacionRepository: generaciones, juegoRepository: juegoRepo, liquidarReserva }, { vencimientoMs: 60000 });
  const real = new ProcesarGeneracion(
    { generacionRepository: generaciones, juegoRepository: juegoRepo, versionRepository: versionRepo, catalogo, generador, liquidarReserva },
    { tiempoLimiteMs }
  );
  // Guarda la promesa del proceso en segundo plano para poder esperarla en la prueba
  const seguimiento = { ultima: Promise.resolve() };
  const procesador = procesar || { ejecutar: (...args) => (seguimiento.ultima = real.ejecutar(...args)) };
  const solicitar = new SolicitarGeneracion(
    {
      generacionRepository: generaciones, cuotaRepository: cuotas, cursoRepository: cursos, estudianteRepository: estudiantes,
      canalRepository: canales, procesarGeneracion: procesador, conciliarGeneraciones: conciliar
    },
    { habilitada: true, limiteDiario: 3, limiteGlobalMensual: 100, ...config }
  );
  const cancelar = new CancelarGeneracion(generaciones, liquidarReserva);
  return { generaciones, cuotas, juegos, versiones, solicitar, cancelar, conciliar, seguimiento };
}

let claves = 0;
const clave = () => `clave-de-prueba-${String(++claves).padStart(6, "0")}`;
const pedido = (extra = {}) => ({ cursoId: CURSO, habilidad: "vocales", tematica: "animales", cantidad: 5, ...extra });
const nuncaResponde = { generar: () => new Promise(() => {}) };

describe("Flujo de generación con IA (generador falso)", () => {
  it("solicitar reserva cupo, responde pendiente y el proceso deja un borrador válido en la biblioteca", async () => {
    const f = armar();
    const { generacion, esNueva } = await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    assert.equal(esNueva, true);
    assert.ok(generacion.reserva, "la reserva queda registrada antes de llamar al proveedor");

    const completada = await f.seguimiento.ultima;
    assert.equal(completada.estado, "completada");
    assert.equal(completada.proveedor, "falso");
    assert.equal(f.juegos.length, 1);
    assert.equal(f.juegos[0].origen, "ia");
    assert.equal(f.juegos[0].generacionId, generacion.id);
    assert.equal(f.juegos[0].estado, "borrador", "la aprobación del docente sigue siendo obligatoria");
    assert.equal(f.versiones[0].ejercicios.length, 5);
    assert.equal(completada.juegoId, f.juegos[0].id);
    assert.deepEqual([f.cuotas.diaria().reservado, f.cuotas.diaria().consumido], [0, 1]);
    assert.deepEqual([f.cuotas.global().reservado, f.cuotas.global().consumido], [0, 1]);
  });

  it("también genera actividades de sílabas", async () => {
    const f = armar();
    await f.solicitar.ejecutar(DOCENTE, clave(), pedido({ habilidad: "palabras_silabas", tematica: "naturaleza" }));
    assert.equal((await f.seguimiento.ultima).estado, "completada");
    assert.equal(f.versiones[0].configuracion.mecanica, "ordenar_silabas");
  });

  it("reenviar la misma clave devuelve la solicitud original sin reservar otra vez", async () => {
    const f = armar();
    const c = clave();
    const primera = await f.solicitar.ejecutar(DOCENTE, c, pedido());
    await f.seguimiento.ultima;
    const repetida = await f.solicitar.ejecutar(DOCENTE, c, pedido());
    assert.equal(repetida.esNueva, false);
    assert.equal(repetida.generacion.id, primera.generacion.id);
    assert.equal(f.cuotas.diaria().reservado + f.cuotas.diaria().consumido, 1);
    assert.equal(f.juegos.length, 1);
  });

  it("con la generación deshabilitada responde LimiteAlcanzado y no guarda nada", async () => {
    const f = armar({ config: { habilitada: false } });
    await assert.rejects(f.solicitar.ejecutar(DOCENTE, clave(), pedido()), (e) => e instanceof LimiteAlcanzado && e.codigo === "GENERACION_DESHABILITADA");
    assert.equal(f.generaciones.filas.size, 0);
  });

  it("rechaza 10 ejercicios mientras no estén habilitados", async () => {
    const f = armar();
    await assert.rejects(f.solicitar.ejecutar(DOCENTE, clave(), pedido({ cantidad: 10 })), EntradaInvalida);
  });

  it("solo permite una generación activa por docente", async () => {
    const f = armar({ generador: nuncaResponde });
    await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    await assert.rejects(f.solicitar.ejecutar(DOCENTE, clave(), pedido()), (e) => e.codigo === "GENERACION_EN_CURSO");
  });

  it("al agotar el cupo diario no registra la solicitud", async () => {
    const f = armar({ config: { limiteDiario: 2 } });
    for (let i = 0; i < 2; i += 1) {
      await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
      await f.seguimiento.ultima;
    }
    await assert.rejects(f.solicitar.ejecutar(DOCENTE, clave(), pedido()), (e) => e.codigo === "CUPO_DIARIO_AGOTADO");
    assert.equal(f.generaciones.filas.size, 2);
    assert.equal(f.cuotas.diaria().consumido, 2);
  });

  it("si se agota el cupo global devuelve la reserva diaria", async () => {
    const f = armar({ config: { limiteGlobalMensual: 0 } });
    await assert.rejects(f.solicitar.ejecutar(DOCENTE, clave(), pedido()), (e) => e.codigo === "CUPO_GLOBAL_AGOTADO");
    assert.equal(f.cuotas.diaria().reservado, 0);
  });

  it("el contenido incoherente no llega a la biblioteca: fallida y el cupo se consume", async () => {
    const malo = {
      async generar(solicitud) {
        const r = await new GeneradorContenidoFalso().generar(solicitud);
        const e = r.ejercicios[0];
        e.respuestaCorrectaId = e.opciones.find((o) => o.id !== e.respuestaCorrectaId).id; // vocal equivocada
        return { ...r, uso: { proveedor: "prueba", modelo: "x", tokensEntrada: 10, tokensSalida: 20 } };
      }
    };
    const f = armar({ generador: malo });
    await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    const final = await f.seguimiento.ultima;
    assert.equal(final.estado, "fallida");
    assert.equal(final.errorCodigo, "CONTENIDO_INVALIDO");
    assert.equal(f.juegos.length, 0);
    assert.equal(f.cuotas.diaria().consumido, 1);
  });

  it("un error del proveedor sin consumo devuelve el cupo", async () => {
    const roto = { generar: async () => { throw new Error("sin conexión"); } };
    const f = armar({ generador: roto });
    await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    const final = await f.seguimiento.ultima;
    assert.equal(final.errorCodigo, "PROVEEDOR_ERROR");
    assert.deepEqual([f.cuotas.diaria().reservado, f.cuotas.diaria().consumido], [0, 0]);
  });

  it("si el proveedor no responde a tiempo queda interrumpida y el cupo se consume", async () => {
    const f = armar({ generador: nuncaResponde, tiempoLimiteMs: 20 });
    await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    const final = await f.seguimiento.ultima;
    assert.equal(final.estado, "interrumpida");
    assert.equal(f.cuotas.diaria().consumido, 1);
  });

  it("cancelar una pendiente devuelve el cupo una sola vez", async () => {
    const f = armar({ procesar: { ejecutar: async () => null } });
    const { generacion } = await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    const cancelada = await f.cancelar.ejecutar(DOCENTE, generacion.id);
    assert.equal(cancelada.errorCodigo, "CANCELADA_POR_DOCENTE");
    assert.deepEqual([f.cuotas.diaria().reservado, f.cuotas.diaria().consumido], [0, 0]);
    await assert.rejects(f.cancelar.ejecutar(DOCENTE, generacion.id), (e) => e.codigo === "GENERACION_NO_CANCELABLE");
  });

  it("si se cancela mientras genera, el borrador que llega después se archiva", async () => {
    let responder;
    const lento = { generar: (s) => new Promise((r) => { responder = () => r(new GeneradorContenidoFalso().generar(s)); }) };
    const f = armar({ generador: lento });
    const { generacion } = await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    await new Promise((r) => setImmediate(r)); // deja que pase a "procesando"
    await f.cancelar.ejecutar(DOCENTE, generacion.id);
    responder();
    assert.equal(await f.seguimiento.ultima, null);
    assert.equal(f.juegos[0].estado, "archivado");
    assert.equal((await f.generaciones.findById(generacion.id, DOCENTE)).estado, "fallida");
    assert.deepEqual([f.cuotas.diaria().reservado, f.cuotas.diaria().consumido], [0, 1]);
  });
});

describe("Conciliación de generaciones", () => {
  const envejecer = (f, id, estado) => {
    const g = f.generaciones.filas.get(id);
    f.generaciones.filas.set(id, new Generacion({ ...g, estado, creadaEn: new Date(Date.now() - 10 * 60000) }));
  };

  it("una vencida en proceso sin juego queda interrumpida y consume el cupo", async () => {
    const f = armar({ procesar: { ejecutar: async () => null } });
    const { generacion } = await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    envejecer(f, generacion.id, "procesando");
    assert.equal(await f.conciliar.ejecutar(), 1);
    assert.equal(f.generaciones.filas.get(generacion.id).estado, "interrumpida");
    assert.equal(f.cuotas.diaria().consumido, 1);
  });

  it("una vencida que seguía pendiente devuelve el cupo", async () => {
    const f = armar({ procesar: { ejecutar: async () => null } });
    const { generacion } = await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    envejecer(f, generacion.id, "pendiente");
    await f.conciliar.ejecutar();
    assert.deepEqual([f.cuotas.diaria().reservado, f.cuotas.diaria().consumido], [0, 0]);
  });

  it("si el juego ya se había guardado, la completa sin duplicar el borrador", async () => {
    const f = armar({ procesar: { ejecutar: async () => null } });
    const { generacion } = await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    envejecer(f, generacion.id, "procesando");
    f.juegos.push({ id: "f".repeat(24), docenteId: DOCENTE, generacionId: generacion.id, estado: "borrador" });
    await f.conciliar.ejecutar();
    const g = f.generaciones.filas.get(generacion.id);
    assert.equal(g.estado, "completada");
    assert.equal(g.juegoId, "f".repeat(24));
    assert.equal(f.juegos.length, 1);
  });

  it("no toca las activas que aún están dentro del tiempo", async () => {
    const f = armar({ procesar: { ejecutar: async () => null } });
    await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    assert.equal(await f.conciliar.ejecutar(), 0);
    await assert.rejects(f.solicitar.ejecutar(DOCENTE, clave(), pedido()), (e) => e.codigo === "GENERACION_EN_CURSO");
  });

  it("una colgada por reinicio no bloquea una nueva solicitud del docente", async () => {
    const f = armar({ procesar: { ejecutar: async () => null } });
    const { generacion } = await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    envejecer(f, generacion.id, "procesando");
    const nueva = await f.solicitar.ejecutar(DOCENTE, clave(), pedido());
    assert.equal(nueva.esNueva, true);
  });
});

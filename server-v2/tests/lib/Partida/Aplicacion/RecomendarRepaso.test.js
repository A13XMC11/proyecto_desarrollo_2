const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const RecomendarRepaso = require("../../../../src/lib/Partida/Aplicacion/RecomendarRepaso");
const ConfiguracionGeneracion = require("../../../../src/lib/Generacion/Dominio/Entidades/ConfiguracionGeneracion");
const Cuota = require("../../../../src/lib/Generacion/Dominio/Entidades/Cuota");
const ConflictoDeEstado = require("../../../../src/lib/Compartido/Dominio/Errores/ConflictoDeEstado");
const LimiteAlcanzado = require("../../../../src/lib/Compartido/Dominio/Errores/LimiteAlcanzado");
const ServicioNoDisponible = require("../../../../src/lib/Compartido/Dominio/Errores/ServicioNoDisponible");
const ErrorDelGenerador = require("../../../../src/lib/Compartido/Dominio/Errores/ErrorDelGenerador");

const DOCENTE = "11111111-1111-4111-8111-111111111111";
const AHORA = new Date("2026-11-23T15:00:00Z");
const MES = "2026-11";
const base = {
  habilitada: true, tiempoLimiteMs: 200, margenConciliacionMs: 0, presupuestoMensual: 10, costoMaximoLlamada: 0.5,
  tarifaEntrada: 1, tarifaSalida: 4, maxRecomendaciones: 2
};
const config = (extra = {}) => new ConfiguracionGeneracion({ ...base, ...extra });

const ANALISIS = {
  partidas: 14, suficiente: true, respondidos: 70,
  habilidades: [{ habilidad: "contar_silabas", respondidos: 20, falloPrimerIntento: 12, sinResolver: 4, conPista: 3, estudiantes: 6, repasar: true }],
  palabras: [{ habilidad: "contar_silabas", objetivo: "mariposa", respondidos: 6, falloPrimerIntento: 4, sinResolver: 1, conPista: 0, estudiantes: 4, repasar: true }]
};
const PROPUESTA = { resumen: "Contar sílabas es lo que más cuesta al curso.", sugerencias: ["Practicar palmadas por sílaba con palabras largas."] };
const USO = { proveedor: "falso", modelo: "m", tokensEntrada: 1_000_000, tokensSalida: 500_000 }; // costo 1*1 + 0.5*4 = 3

// Contadores en memoria con la misma semántica que el repositorio real
function cuotas({ negarDocente = false, negarGlobal = false } = {}) {
  const filas = new Map();
  const registro = { reservar: [], liberar: [], consumir: [] };
  const fila = (docenteId, periodo) => {
    const clave = `${docenteId || "global"}|${periodo}`;
    if (!filas.has(clave)) filas.set(clave, { id: `c${filas.size + 1}`, docenteId, periodo, reservado: 0, consumido: 0 });
    return filas.get(clave);
  };
  const entidad = (f) => new Cuota({ ...f, docenteId: f.docenteId });
  return {
    filas, registro,
    async obtener(docenteId, periodo) { return entidad(fila(docenteId, periodo)); },
    async reservar({ docenteId, periodo, cantidad, limite }) {
      registro.reservar.push({ docenteId, periodo, cantidad, limite });
      const f = fila(docenteId, periodo);
      if ((docenteId ? negarDocente : negarGlobal) || f.reservado + f.consumido + cantidad > limite) return { reservada: false, cuota: entidad(f) };
      f.reservado += cantidad;
      return { reservada: true, cuota: entidad(f) };
    },
    async liberar({ cuotaId, cantidad }) {
      registro.liberar.push({ cuotaId, cantidad });
      const f = [...filas.values()].find((x) => x.id === cuotaId);
      f.reservado -= cantidad;
      return { liberada: true };
    },
    async consumir({ cuotaId, cantidad, real = cantidad }) {
      registro.consumir.push({ cuotaId, cantidad, real });
      const f = [...filas.values()].find((x) => x.id === cuotaId);
      f.reservado -= cantidad;
      f.consumido += real;
      return { consumida: true };
    }
  };
}

function armar({ cfg = config(), analisis = ANALISIS, redactar, cuotaOpciones } = {}) {
  const pedidos = { filtros: null, redactor: [] };
  const sugerirRepaso = { ejecutar: async (d, f) => { pedidos.filtros = { d, f }; return analisis; } };
  const redactor = {
    redactar: redactar || (async (a, o) => { pedidos.redactor.push({ a, o }); return { propuesta: PROPUESTA, uso: USO }; })
  };
  const cuotaRepository = cuotas(cuotaOpciones);
  return { caso: new RecomendarRepaso({ sugerirRepaso, redactor, cuotaRepository, config: cfg }), cuotaRepository, pedidos };
}
const consumoDe = (cuotaRepository, docente) => [...cuotaRepository.filas.values()].find((f) => (docente ? f.docenteId : !f.docenteId));

describe("RecomendarRepaso", () => {
  it("con la IA apagada no hace nada: ni analiza ni reserva", async () => {
    const { caso, cuotaRepository, pedidos } = armar({ cfg: new ConfiguracionGeneracion() });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e instanceof ServicioNoDisponible && e.codigo === "RECOMENDACION_DESHABILITADA");
    assert.equal(pedidos.filtros, null);
    assert.equal(cuotaRepository.registro.reservar.length, 0);
  });

  it("con pocos datos avisa y no gasta cupo ni llama a la IA", async () => {
    const { caso, cuotaRepository, pedidos } = armar({ analisis: { suficiente: false, partidas: 1, respondidos: 2, habilidades: [], palabras: [] } });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e instanceof ConflictoDeEstado && e.codigo === "DATOS_INSUFICIENTES");
    assert.equal(cuotaRepository.registro.reservar.length, 0);
    assert.equal(pedidos.redactor.length, 0);
  });

  it("recomienda: analiza con los filtros, reserva cupo y presupuesto, llama una vez y consume el costo real", async () => {
    const { caso, cuotaRepository, pedidos } = armar();
    const r = await caso.ejecutar(DOCENTE, { cursoId: "curso-1" }, AHORA);

    assert.deepEqual(pedidos.filtros, { d: DOCENTE, f: { cursoId: "curso-1" } });
    assert.equal(pedidos.redactor.length, 1);
    assert.deepEqual(pedidos.redactor[0].a, ANALISIS, "la IA recibe solo el análisis del servidor");
    assert.ok(pedidos.redactor[0].o.signal, "con señal de cancelación");

    const [docente, global] = cuotaRepository.registro.reservar;
    assert.deepEqual(docente, { docenteId: DOCENTE, periodo: MES, cantidad: 1, limite: 2 });
    assert.deepEqual({ ...global, docenteId: undefined }, { docenteId: undefined, periodo: MES, cantidad: 0.5, limite: 10 });
    assert.equal(consumoDe(cuotaRepository, true).consumido, 1);
    assert.equal(consumoDe(cuotaRepository, false).consumido, 3, "costo real, no el reservado");
    assert.equal(consumoDe(cuotaRepository, false).reservado, 0);

    assert.equal(r.resumen, PROPUESTA.resumen);
    assert.deepEqual(r.sugerencias, PROPUESTA.sugerencias);
    assert.equal(r.cupoRestante, 1);
  });

  it("sin cupo mensual del docente no reserva presupuesto ni llama a la IA", async () => {
    const { caso, cuotaRepository, pedidos } = armar({ cuotaOpciones: { negarDocente: true } });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e instanceof LimiteAlcanzado && e.codigo === "RECOMENDACIONES_AGOTADAS");
    assert.equal(cuotaRepository.registro.reservar.length, 1);
    assert.equal(pedidos.redactor.length, 0);
  });

  it("con el presupuesto global agotado devuelve el cupo del docente y no llama a la IA", async () => {
    const { caso, cuotaRepository, pedidos } = armar({ cuotaOpciones: { negarGlobal: true } });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e instanceof LimiteAlcanzado && e.codigo === "PRESUPUESTO_AGOTADO");
    assert.equal(consumoDe(cuotaRepository, true).reservado, 0);
    assert.equal(cuotaRepository.registro.liberar.length, 1);
    assert.equal(pedidos.redactor.length, 0);
  });

  it("si la IA falla informando el consumo, se cobra lo real y se relanza el error", async () => {
    const { caso, cuotaRepository } = armar({ redactar: async () => { throw new ErrorDelGenerador("cortada", "GENERADOR_RESPUESTA_INCOMPLETA", USO); } });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e.codigo === "GENERADOR_RESPUESTA_INCOMPLETA");
    assert.equal(consumoDe(cuotaRepository, true).consumido, 1);
    assert.equal(consumoDe(cuotaRepository, false).consumido, 3);
  });

  it("si la IA falla sin informar el consumo, se cobra todo lo reservado (nunca queda retenido ni en cero)", async () => {
    const { caso, cuotaRepository } = armar({ redactar: async () => { throw new ErrorDelGenerador("caído", "GENERADOR_ERROR"); } });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e.codigo === "GENERADOR_ERROR");
    assert.equal(consumoDe(cuotaRepository, true).consumido, 1);
    assert.equal(consumoDe(cuotaRepository, false).consumido, 0.5);
    assert.equal(consumoDe(cuotaRepository, false).reservado, 0);
  });

  it("un error inesperado del redactor se oculta como fallo del generador", async () => {
    const { caso } = armar({ redactar: async () => { throw new Error("clave sk-secreta en el mensaje"); } });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e instanceof ErrorDelGenerador && e.codigo === "GENERADOR_ERROR" && !/sk-secreta/.test(e.message));
  });

  it("una propuesta con HTML o enlaces se rechaza, pero el consumo real queda registrado", async () => {
    const { caso, cuotaRepository } = armar({
      redactar: async () => ({ propuesta: { resumen: "Visita https://malo.example ahora mismo", sugerencias: ["Haz algo útil con el grupo"] }, uso: USO })
    });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e instanceof ErrorDelGenerador && e.codigo === "GENERADOR_RESPUESTA_INVALIDA");
    assert.equal(consumoDe(cuotaRepository, false).consumido, 3);
  });

  it("si la IA no responde a tiempo corta la espera, cancela y cobra lo reservado", async () => {
    let senal;
    const { caso, cuotaRepository } = armar({
      cfg: config({ tiempoLimiteMs: 20 }),
      redactar: (a, { signal }) => { senal = signal; return new Promise(() => {}); }
    });
    await assert.rejects(caso.ejecutar(DOCENTE, {}, AHORA), (e) => e.codigo === "GENERADOR_TIEMPO_AGOTADO");
    assert.equal(senal.aborted, true);
    assert.equal(consumoDe(cuotaRepository, true).consumido, 1);
    assert.equal(consumoDe(cuotaRepository, false).consumido, 0.5);
  });
});

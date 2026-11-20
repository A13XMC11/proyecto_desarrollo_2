const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const SesionJuego = require("../../../../src/lib/Partida/Dominio/Entidades/SesionJuego");
const IndicadoresPartida = require("../../../../src/lib/Partida/Dominio/Entidades/IndicadoresPartida");
const ConsultarResultados = require("../../../../src/lib/Partida/Aplicacion/ConsultarResultados");
const ObtenerResumenInicio = require("../../../../src/lib/Partida/Aplicacion/ObtenerResumenInicio");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const DOCENTE = "11111111-1111-4111-8111-111111111111";
const CURSO = "22222222-2222-4222-8222-222222222222";
const ANA = "33333333-3333-4333-8333-333333333333";
const LUIS = "44444444-4444-4444-8444-444444444444";
const J_VOCALES = "a".repeat(24);
const J_SILABAS = "b".repeat(24);
const V_VOCALES = "c".repeat(24);
const V_SILABAS = "d".repeat(24);

let op = 0;
const intento = (ejercicioId, numeroIntento, esCorrecto) => ({ ejercicioId, numeroIntento, esCorrecto, eleccion: "x", operacionId: `op-${++op}` });
const pista = (ejercicioId) => ({ ejercicioId, operacionId: `op-${++op}` });
const sesion = (extra) => new SesionJuego({
  id: `s${++op}`, docenteId: DOCENTE, cursoId: CURSO, estudianteId: ANA, juegoId: J_VOCALES, versionId: V_VOCALES,
  canalInicioId: "e".repeat(24), estado: "finalizada", ...extra
});

// Ejemplo calculado a mano (5 ejercicios disponibles):
// e1: bien al primer intento                     -> primer intento, sin ayuda, completado
// e2: mal y luego bien, con pista                -> completado, con ayuda
// e3: mal y mal (se muestra la solución)         -> completado, sin acierto
// e4: bien al primer intento, pero pidió pista   -> primer intento, con ayuda, completado
// e5: sin responder
const partidaDeEjemplo = () => sesion({
  intentos: [
    intento("e1", 1, true),
    intento("e2", 1, false), intento("e2", 2, true),
    intento("e3", 1, false), intento("e3", 2, false),
    intento("e4", 1, true)
  ],
  pistas: [pista("e2"), pista("e4")]
});

describe("IndicadoresPartida (§7.3)", () => {
  it("coincide con el ejemplo calculado a mano", () => {
    const i = IndicadoresPartida.deSesion(partidaDeEjemplo(), 5);
    assert.deepEqual({ ...i }, {
      respondidos: 4, primerIntento: 2, sinAyuda: 1, intentosTotales: 6, pistas: 2, completados: 4, disponibles: 5
    });
  });

  it("una partida sin respuestas no tiene denominador", () => {
    const i = IndicadoresPartida.deSesion(sesion({ estado: "en_curso" }), 5);
    assert.equal(i.respondidos, 0);
    assert.equal(i.completados, 0);
    assert.equal(i.disponibles, 5);
  });

  it("un ejercicio con un solo fallo aún no está completado", () => {
    const i = IndicadoresPartida.deSesion(sesion({ estado: "en_curso", intentos: [intento("e1", 1, false)] }), 5);
    assert.equal(i.completados, 0);
    assert.equal(i.respondidos, 1);
  });

  it("sumar acumula cada indicador", () => {
    const a = IndicadoresPartida.deSesion(partidaDeEjemplo(), 5);
    const total = IndicadoresPartida.sumar([a, a]);
    assert.equal(total.primerIntento, 4);
    assert.equal(total.disponibles, 10);
  });
});

function armar(sesiones) {
  const juegos = {
    [J_VOCALES]: { id: J_VOCALES, titulo: "Vocales de animales", habilidad: "vocales" },
    [J_SILABAS]: { id: J_SILABAS, titulo: "Sílabas", habilidad: "palabras_silabas" }
  };
  const versiones = {
    [V_VOCALES]: { id: V_VOCALES, configuracion: { cantidadEjercicios: 5 } },
    [V_SILABAS]: { id: V_SILABAS, configuracion: { cantidadEjercicios: 5 } }
  };
  const consultas = { juegos: 0, versiones: 0, filtros: null };
  const sesionRepo = {
    findByFiltros: async (docenteId, filtros) => {
      consultas.filtros = filtros;
      return docenteId === DOCENTE ? sesiones : [];
    }
  };
  const juegoRepo = { findById: async (id, d) => { consultas.juegos++; return d === DOCENTE ? juegos[id] || null : null; } };
  const versionRepo = { findById: async (id) => { consultas.versiones++; return versiones[id] || null; } };
  return { caso: new ConsultarResultados(sesionRepo, juegoRepo, versionRepo), consultas };
}

describe("ConsultarResultados", () => {
  const sesiones = () => [
    partidaDeEjemplo(),
    sesion({ intentos: [intento("e1", 1, true)] }), // Ana, vocales: 1 de 1 al primer intento
    sesion({ estudianteId: LUIS, juegoId: J_SILABAS, versionId: V_SILABAS, intentos: [intento("e1", 1, false)] }),
    sesion({ estado: "en_curso", intentos: [intento("e1", 1, true)] }),
    sesion({ estado: "abandonada" })
  ];

  it("agrega solo las partidas finalizadas y cuenta aparte las incompletas", async () => {
    const { resumen } = await armar(sesiones()).caso.ejecutar(DOCENTE);
    assert.equal(resumen.partidas, 3);
    assert.equal(resumen.enCurso, 1);
    assert.equal(resumen.abandonadas, 1);
    assert.equal(resumen.respondidos, 4 + 1 + 1);
    assert.equal(resumen.primerIntento, 2 + 1 + 0);
    assert.equal(resumen.disponibles, 15);
  });

  it("agrupa por estudiante y por habilidad", async () => {
    const { porEstudiante, porHabilidad } = await armar(sesiones()).caso.ejecutar(DOCENTE);
    const ana = porEstudiante.find((g) => g.estudianteId === ANA);
    assert.deepEqual([ana.partidas, ana.primerIntento, ana.respondidos], [2, 3, 5]);
    const silabas = porHabilidad.find((g) => g.habilidad === "palabras_silabas");
    assert.deepEqual([silabas.partidas, silabas.primerIntento, silabas.respondidos], [1, 0, 1]);
  });

  it("cada partida trae título, habilidad e indicadores; consulta una vez por juego y versión", async () => {
    const { caso, consultas } = armar(sesiones());
    const { partidas } = await caso.ejecutar(DOCENTE);
    assert.equal(partidas.length, 5);
    assert.equal(partidas[0].titulo, "Vocales de animales");
    assert.equal(partidas[0].indicadores.completados, 4);
    assert.equal(consultas.juegos, 2);
    assert.equal(consultas.versiones, 2);
  });

  it("pasa los filtros al repositorio y rechaza una habilidad o fecha inválida", async () => {
    const { caso, consultas } = armar([]);
    await caso.ejecutar(DOCENTE, { cursoId: CURSO, juegoId: J_VOCALES, habilidad: "vocales", desde: "2026-11-01" });
    assert.equal(consultas.filtros.juegoId, J_VOCALES);
    assert.ok(consultas.filtros.desde instanceof Date);
    await assert.rejects(caso.ejecutar(DOCENTE, { habilidad: "matematicas" }), EntradaInvalida);
    await assert.rejects(caso.ejecutar(DOCENTE, { desde: "ayer" }), EntradaInvalida);
  });

  it("sin partidas devuelve ceros, no porcentajes inventados", async () => {
    const { resumen, porEstudiante } = await armar([]).caso.ejecutar(DOCENTE);
    assert.equal(resumen.partidas, 0);
    assert.equal(resumen.respondidos, 0);
    assert.deepEqual(porEstudiante, []);
  });
});

describe("ObtenerResumenInicio", () => {
  it("reúne cursos, actividades recientes y partidas para retomar con su título", async () => {
    const pedidos = [];
    const sesionRepo = {
      contar: async (d, filtros) => { pedidos.push(filtros); return filtros.estado === "en_curso" ? 7 : 2; },
      listarEnCurso: async () => [sesion({ estado: "en_curso", ejercicioActual: 2 })]
    };
    const juegoRepo = {
      findPaginado: async () => ({ total: 4, items: [{ id: J_VOCALES, titulo: "Vocales de animales" }] }),
      findById: async (id) => (id === J_VOCALES ? { id, titulo: "Vocales de animales" } : null)
    };
    const cursoRepo = { contarActivos: async () => 2 };
    const ahora = new Date("2026-11-19T12:00:00Z");
    const r = await new ObtenerResumenInicio(sesionRepo, juegoRepo, cursoRepo).ejecutar(DOCENTE, ahora);

    assert.equal(r.cursosActivos, 2);
    assert.equal(r.actividades.total, 4);
    assert.equal(r.enCurso.total, 7);
    assert.equal(r.enCurso.partidas[0].titulo, "Vocales de animales");
    assert.equal(r.enCurso.partidas[0].ejercicioActual, 2);
    assert.equal(r.terminadasSemana, 2);
    const semana = pedidos.find((p) => p.estado === "finalizada");
    assert.equal(semana.desde.toISOString(), "2026-11-12T12:00:00.000Z");
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const SesionJuego = require("../../../../src/lib/Partida/Dominio/Entidades/SesionJuego");
const SugerirRepaso = require("../../../../src/lib/Partida/Aplicacion/SugerirRepaso");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const DOCENTE = "11111111-1111-4111-8111-111111111111";
const CURSO = "22222222-2222-4222-8222-222222222222";
const ANA = "33333333-3333-4333-8333-333333333333";
const JUEGO = "a".repeat(24);
const VERSION = "c".repeat(24);

let op = 0;
const intento = (ejercicioId, numeroIntento, esCorrecto) => ({ ejercicioId, numeroIntento, esCorrecto, eleccion: "x", operacionId: `op-${++op}` });
const sesion = (extra) => new SesionJuego({
  id: `s${++op}`, docenteId: DOCENTE, cursoId: CURSO, estudianteId: ANA, juegoId: JUEGO, versionId: VERSION,
  canalInicioId: "e".repeat(24), estado: "finalizada", ...extra
});

function armar(sesiones) {
  const consultas = { filtros: null, juegos: 0, versiones: 0 };
  const sesionRepo = { findByFiltros: async (d, f) => { consultas.filtros = f; return d === DOCENTE ? sesiones.filter((x) => !f.estado || x.estado === f.estado) : []; } };
  const juegoRepo = { findById: async (id, d) => { consultas.juegos++; return d === DOCENTE ? { id, titulo: "Sílabas", habilidad: "contar_silabas" } : null; } };
  const versionRepo = {
    findById: async () => {
      consultas.versiones++;
      return { id: VERSION, ejercicios: ["sol", "luna", "mesa", "pato", "gato"].map((objetivo, i) => ({ id: `e${i + 1}`, objetivo })) };
    }
  };
  return { caso: new SugerirRepaso(sesionRepo, juegoRepo, versionRepo), consultas };
}

describe("SugerirRepaso", () => {
  it("usa solo partidas finalizadas y sugiere la habilidad y las palabras más difíciles", async () => {
    const dificil = () => sesion({ intentos: [intento("e1", 1, false), intento("e1", 2, false), intento("e2", 1, false), intento("e2", 2, true), intento("e3", 1, true), intento("e4", 1, true), intento("e5", 1, true)] });
    const { caso, consultas } = armar([dificil(), dificil(), sesion({ estado: "en_curso", intentos: [intento("e1", 1, true)] })]);
    const r = await caso.ejecutar(DOCENTE, { cursoId: CURSO });

    assert.equal(consultas.filtros.estado, "finalizada");
    assert.equal(consultas.filtros.cursoId, CURSO);
    assert.equal(consultas.juegos, 1);
    assert.equal(consultas.versiones, 1);
    assert.equal(r.suficiente, true);
    assert.equal(r.partidas, 2);
    assert.equal(r.habilidades[0].habilidad, "contar_silabas");
    assert.equal(r.habilidades[0].repasar, true);
    assert.deepEqual(r.palabras.map((p) => p.objetivo), ["sol", "luna"]);
  });

  it("sin partidas terminadas dice que no hay datos suficientes", async () => {
    const r = await armar([]).caso.ejecutar(DOCENTE);
    assert.equal(r.suficiente, false);
    assert.equal(r.partidas, 0);
    assert.deepEqual(r.habilidades, []);
  });

  it("rechaza una habilidad o fecha inválida", async () => {
    const { caso } = armar([]);
    await assert.rejects(caso.ejecutar(DOCENTE, { habilidad: "matematicas" }), EntradaInvalida);
    await assert.rejects(caso.ejecutar(DOCENTE, { desde: "ayer" }), EntradaInvalida);
  });
});

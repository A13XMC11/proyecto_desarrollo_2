const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const SesionJuego = require("../../../../src/lib/Partida/Dominio/Entidades/SesionJuego");
const Intento = require("../../../../src/lib/Partida/Dominio/Entidades/Intento");
const Pista = require("../../../../src/lib/Partida/Dominio/Entidades/Pista");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const ses = { docenteId: "d", cursoId: "c", estudianteId: "e", juegoId: "j", versionId: "v", canalInicioId: "k" };
const intento = { ejercicioId: "e1", numeroIntento: 1, eleccion: "a", esCorrecto: true, operacionId: "op-1" };

describe("Entidad Intento y Pista", () => {
  it("acepta elección de texto o lista de textos", () => {
    assert.equal(new Intento(intento).usoPista, false);
    assert.deepEqual(new Intento({ ...intento, eleccion: ["p1", "p2"] }).eleccion, ["p1", "p2"]);
  });

  it("rechaza intentos inválidos", () => {
    for (const malo of [
      { ...intento, numeroIntento: 3 },
      { ...intento, eleccion: 5 },
      { ...intento, eleccion: [] },
      { ...intento, eleccion: [1] },
      { ...intento, esCorrecto: "si" },
      { ...intento, operacionId: undefined },
      { ...intento, ejercicioId: undefined }
    ]) {
      assert.throws(() => new Intento(malo), EntradaInvalida);
    }
    assert.throws(() => new Pista({ ejercicioId: "e1" }), EntradaInvalida);
  });
});

describe("Entidad SesionJuego", () => {
  it("nace en curso y reconoce operaciones ya registradas", () => {
    const s = new SesionJuego({ ...ses, intentos: [intento], pistas: [{ ejercicioId: "e1", operacionId: "op-2" }] });
    assert.equal(s.estaEnCurso(), true);
    assert.equal(s.ejercicioActual, 0);
    assert.ok(s.intentos[0] instanceof Intento);
    assert.equal(s.tieneOperacion("op-1"), true);
    assert.equal(s.tieneOperacion("op-2"), true);
    assert.equal(s.tieneOperacion("op-3"), false);
  });

  it("rechaza datos inválidos", () => {
    for (const malo of [
      { ...ses, estado: "x" },
      { ...ses, ejercicioActual: -1 },
      { ...ses, ejercicioActual: 1.5 },
      { ...ses, versionId: undefined },
      { ...ses, canalInicioId: undefined },
      { ...ses, semilla: "x" },
      { ...ses, intentos: "no" }
    ]) {
      assert.throws(() => new SesionJuego(malo), EntradaInvalida);
    }
  });
});

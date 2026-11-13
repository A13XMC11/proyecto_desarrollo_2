const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Ejercicio = require("../../../../src/lib/Juego/Dominio/Entidades/Ejercicio");
const { ejercicioJugable, solucionDe } = require("../../../../src/lib/Partida/Dominio/Entidades/VistaJugable");

const opcion = new Ejercicio({
  id: "e1", consigna: "¿Con qué vocal empieza?", pista: "Suena como aaa",
  opciones: [{ id: "a", texto: "A" }, { id: "e", texto: "E" }, { id: "o", texto: "O" }],
  respuestaCorrectaId: "a"
});
const silabas = new Ejercicio({
  id: "e2", consigna: "Forma la palabra", palabraId: "gato",
  piezas: [{ id: "p1", texto: "ga" }, { id: "p2", texto: "to" }], ordenCorrecto: ["p1", "p2"]
});

describe("VistaJugable", () => {
  it("nunca expone la respuesta ni el orden correcto", () => {
    for (const e of [opcion, silabas]) {
      const vista = ejercicioJugable(e, 123, 0);
      assert.equal(vista.respuestaCorrectaId, undefined);
      assert.equal(vista.ordenCorrecto, undefined);
      assert.equal(vista.pista, undefined);
    }
    assert.equal(ejercicioJugable(opcion, 1, 0).tienePista, true);
    assert.equal(ejercicioJugable(silabas, 1, 0).tienePista, false);
  });

  it("mezcla de forma estable con la misma semilla y conserva todas las piezas", () => {
    const a = ejercicioJugable(opcion, 42, 0).opciones.map((o) => o.id);
    const b = ejercicioJugable(opcion, 42, 0).opciones.map((o) => o.id);
    assert.deepEqual(a, b);
    assert.deepEqual([...a].sort(), ["a", "e", "o"]);
  });

  it("las piezas no quedan en el orden correcto cuando hay alternativa", () => {
    for (let semilla = 0; semilla < 50; semilla++) {
      const ids = ejercicioJugable(silabas, semilla, 0).piezas.map((p) => p.id);
      assert.notDeepEqual(ids, ["p1", "p2"]);
    }
  });

  it("solucionDe devuelve la respuesta según la mecánica", () => {
    assert.equal(solucionDe(opcion), "a");
    assert.deepEqual(solucionDe(silabas), ["p1", "p2"]);
  });
});

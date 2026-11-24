import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { indexarEnCurso } from "./PartidasEnCurso.js";

describe("indexarEnCurso: qué partida retomar por estudiante", () => {
  const partidas = [
    { id: "p1", juegoId: "j1", estudianteId: "e1" },
    { id: "p2", juegoId: "j2", estudianteId: "e2" },
    { id: "p3", juegoId: "j1", estudianteId: "e3" }
  ];

  it("solo cuenta las partidas de este juego y devuelve el id de la partida de cada estudiante", () => {
    const indice = indexarEnCurso(partidas, "j1");
    assert.equal(indice.get("e1"), "p1");
    assert.equal(indice.get("e3"), "p3");
    assert.equal(indice.has("e2"), false);
  });

  it("sin partidas en curso el índice queda vacío", () => {
    assert.equal(indexarEnCurso([], "j1").size, 0);
  });
});

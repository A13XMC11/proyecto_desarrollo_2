const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const AnalisisRepaso = require("../../../../src/lib/Partida/Dominio/Entidades/AnalisisRepaso");

let op = 0;
const intento = (ejercicioId, numeroIntento, esCorrecto) => ({ ejercicioId, numeroIntento, esCorrecto, eleccion: "x", operacionId: `op-${++op}` });
const pista = (ejercicioId) => ({ ejercicioId, operacionId: `op-${++op}` });

const ejercicios = (objetivos) => objetivos.map((objetivo, i) => ({ id: `e${i + 1}`, objetivo }));
const partida = ({ habilidad, estudianteId = "ana", objetivos, intentos, pistas = [] }) => ({
  habilidad, estudianteId, ejercicios: ejercicios(objetivos), intentos, pistas
});

// Resuelve al primer intento, falla y acierta al segundo, o falla los dos
const bien = (e) => [intento(e, 1, true)];
const tarde = (e) => [intento(e, 1, false), intento(e, 2, true)];
const mal = (e) => [intento(e, 1, false), intento(e, 2, false)];

describe("AnalisisRepaso", () => {
  it("con pocas respuestas dice que no hay datos suficientes y no recomienda nada", () => {
    const r = AnalisisRepaso.analizar([
      partida({ habilidad: "vocales", objetivos: ["sol", "luna"], intentos: [...mal("e1"), ...mal("e2")] })
    ]);
    assert.equal(r.suficiente, false);
    assert.equal(r.respondidos, 2);
    assert.deepEqual(r.habilidades, []);
    assert.deepEqual(r.palabras, []);
  });

  it("marca para repasar la habilidad donde fallan el primer intento con frecuencia", () => {
    const r = AnalisisRepaso.analizar([
      partida({
        habilidad: "contar_silabas", objetivos: ["sol", "luna", "mesa", "pato", "gato"],
        intentos: [...mal("e1"), ...tarde("e2"), ...mal("e3"), ...bien("e4"), ...bien("e5")]
      }),
      partida({
        habilidad: "vocales", objetivos: ["sol", "luna", "mesa", "pato", "gato"],
        intentos: [...bien("e1"), ...bien("e2"), ...bien("e3"), ...bien("e4"), ...tarde("e5")]
      })
    ]);
    assert.equal(r.suficiente, true);
    assert.equal(r.respondidos, 10);
    const [primera, segunda] = r.habilidades;
    assert.equal(primera.habilidad, "contar_silabas");
    assert.deepEqual(
      { r: primera.respondidos, f: primera.falloPrimerIntento, s: primera.sinResolver, repasar: primera.repasar },
      { r: 5, f: 3, s: 2, repasar: true }
    );
    assert.equal(segunda.habilidad, "vocales");
    assert.equal(segunda.falloPrimerIntento, 1);
    assert.equal(segunda.repasar, false);
  });

  it("una habilidad con pocas respuestas se muestra pero no se recomienda repasarla", () => {
    const r = AnalisisRepaso.analizar([
      partida({
        habilidad: "vocales", objetivos: ["a", "b", "c", "d", "e"],
        intentos: [...bien("e1"), ...bien("e2"), ...bien("e3"), ...bien("e4"), ...bien("e5")]
      }),
      partida({ habilidad: "completar_silaba", objetivos: ["pa _ to"], intentos: mal("e1") })
    ]);
    const completar = r.habilidades.find((h) => h.habilidad === "completar_silaba");
    assert.equal(completar.respondidos, 1);
    assert.equal(completar.repasar, false);
  });

  it("junta la misma palabra de distintos estudiantes y la recomienda si se les dificulta", () => {
    const base = { habilidad: "palabras_silabas", objetivos: ["mariposa", "sol", "luna", "mesa", "pato"] };
    const r = AnalisisRepaso.analizar([
      partida({ ...base, estudianteId: "ana", intentos: [...mal("e1"), ...bien("e2"), ...bien("e3"), ...bien("e4"), ...bien("e5")] }),
      partida({ ...base, estudianteId: "luis", intentos: [...tarde("e1"), ...bien("e2"), ...bien("e3"), ...bien("e4"), ...bien("e5")] }),
      partida({ ...base, estudianteId: "eva", intentos: [...bien("e1"), ...bien("e2"), ...bien("e3"), ...bien("e4"), ...bien("e5")] })
    ]);
    assert.equal(r.palabras.length, 1);
    const [mariposa] = r.palabras;
    assert.equal(mariposa.objetivo, "mariposa");
    assert.equal(mariposa.habilidad, "palabras_silabas");
    assert.deepEqual(
      { r: mariposa.respondidos, f: mariposa.falloPrimerIntento, s: mariposa.sinResolver, est: mariposa.estudiantes },
      { r: 3, f: 2, s: 1, est: 2 }
    );
  });

  it("cuenta las pistas y no cuenta como fallo un ejercicio acertado al primer intento con pista", () => {
    const r = AnalisisRepaso.analizar([
      partida({
        habilidad: "vocales", objetivos: ["a", "b", "c", "d", "e"],
        intentos: [...bien("e1"), ...bien("e2"), ...bien("e3"), ...bien("e4"), ...bien("e5")],
        pistas: [pista("e1"), pista("e2")]
      })
    ]);
    const [vocales] = r.habilidades;
    assert.equal(vocales.conPista, 2);
    assert.equal(vocales.falloPrimerIntento, 0);
  });

  it("ignora los ejercicios sin objetivo al agrupar palabras pero los cuenta en la habilidad", () => {
    const p = partida({
      habilidad: "vocales", objetivos: [undefined, undefined, undefined, undefined, undefined],
      intentos: [...mal("e1"), ...mal("e2"), ...mal("e3"), ...mal("e4"), ...mal("e5")]
    });
    const r = AnalisisRepaso.analizar([p, p]);
    assert.equal(r.habilidades[0].respondidos, 10);
    assert.deepEqual(r.palabras, []);
  });

  it("sin partidas devuelve un análisis vacío", () => {
    const r = AnalisisRepaso.analizar([]);
    assert.deepEqual({ ...r }, { suficiente: false, respondidos: 0, habilidades: [], palabras: [] });
  });
});

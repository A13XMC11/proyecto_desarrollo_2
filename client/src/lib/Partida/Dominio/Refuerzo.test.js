import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enlaceRefuerzo, leerRefuerzo, habilidadesParaReforzar } from "./Refuerzo.js";

const HABILIDADES = ["vocales", "palabras_silabas", "completar_silaba", "contar_silabas"];
const repaso = {
  habilidades: [
    { habilidad: "contar_silabas", repasar: true },
    { habilidad: "vocales", repasar: false }
  ],
  palabras: [
    { habilidad: "contar_silabas", objetivo: "mariposa" },
    { habilidad: "vocales", objetivo: "elefante" },
    { habilidad: "completar_silaba", objetivo: "pa _ to" }
  ]
};

describe("habilidadesParaReforzar", () => {
  it("une las habilidades marcadas y las de las palabras que más se dificultan, sin repetir y sin pasar de tres", () => {
    assert.deepEqual(habilidadesParaReforzar(repaso), ["contar_silabas", "vocales", "completar_silaba"]);
    assert.deepEqual(habilidadesParaReforzar({ habilidades: [], palabras: [] }), []);
    const muchas = { habilidades: HABILIDADES.map((habilidad) => ({ habilidad, repasar: true })), palabras: [] };
    assert.equal(habilidadesParaReforzar(muchas).length, 3);
  });
});

describe("enlaceRefuerzo", () => {
  it("lleva a crear con IA con la habilidad, el curso y las palabras de esa habilidad", () => {
    const enlace = enlaceRefuerzo({ habilidad: "contar_silabas", palabras: repaso.palabras, cursoId: "curso-1" });
    const url = new URL(enlace, "http://x");
    assert.equal(url.pathname, "/panel/crear");
    assert.equal(url.searchParams.get("habilidad"), "contar_silabas");
    assert.equal(url.searchParams.get("curso"), "curso-1");
    assert.match(url.searchParams.get("instruccion"), /mariposa/);
    assert.doesNotMatch(url.searchParams.get("instruccion"), /elefante/, "solo las de esa habilidad");
  });

  it("omite las palabras que son patrones (un hueco) y el curso vacío", () => {
    const url = new URL(enlaceRefuerzo({ habilidad: "completar_silaba", palabras: repaso.palabras }), "http://x");
    assert.equal(url.searchParams.get("instruccion"), null);
    assert.equal(url.searchParams.get("curso"), null);
  });

  it("limita a cinco palabras y mantiene la instrucción corta y en texto plano", () => {
    const palabras = ["sol", "luna", "mesa", "pato", "gato", "perro", "casa"].map((objetivo) => ({ habilidad: "vocales", objetivo }));
    const instruccion = new URL(enlaceRefuerzo({ habilidad: "vocales", palabras }), "http://x").searchParams.get("instruccion");
    assert.equal(instruccion.split(",").length, 5);
    assert.ok(instruccion.length <= 500);
    assert.doesNotMatch(instruccion, /[<>]|https?:/);
  });
});

describe("leerRefuerzo", () => {
  const leer = (consulta) => leerRefuerzo(new URLSearchParams(consulta), HABILIDADES);

  it("lee la habilidad, el curso y la instrucción del enlace", () => {
    assert.deepEqual(leer("habilidad=vocales&curso=c1&instruccion=Reforzar%20sol"), { habilidad: "vocales", cursoId: "c1", instruccion: "Reforzar sol" });
  });

  it("ignora una habilidad desconocida y recorta una instrucción demasiado larga", () => {
    assert.equal(leer("habilidad=matematicas").habilidad, undefined);
    assert.equal(leer(`instruccion=${"a".repeat(900)}`).instruccion.length, 500);
    assert.deepEqual(leer(""), {});
  });
});

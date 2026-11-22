import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aContrato, aFormulario, ejercicioVacio, recursosPara, revisar, sugerirOpcionesCompletar, sugerirOpcionesConteo, sugerirSegunHabilidad, usaOpciones
} from "./Ejercicios.js";

const RECURSOS = [
  { id: "abeja", palabra: "abeja", silabas: ["a", "be", "ja"], vocalInicial: "a", icono: "🐝" },
  { id: "gato", palabra: "gato", silabas: ["ga", "to"], icono: "🐱" },
  { id: "elefante", palabra: "elefante", silabas: ["e", "le", "fan", "te"], vocalInicial: "e", icono: "🐘" },
  { id: "mariposa", palabra: "mariposa", silabas: ["ma", "ri", "po", "sa"], icono: "🦋" },
  { id: "oso", palabra: "oso", silabas: ["o", "so"], vocalInicial: "o" },
  { id: "perro", palabra: "perro", silabas: ["pe", "rro"], icono: "🐶" }
];

const completar = (extra = {}) => ({ recursoId: "abeja", consigna: "¿Qué sílaba falta?", pista: "", indice: 1, opciones: ["be", "ga", "to"], correcta: 0, ...extra });
const contar = (extra = {}) => ({ recursoId: "abeja", consigna: "¿Cuántas?", pista: "", opciones: ["2", "3", "4"], correcta: 1, ...extra });

describe("recursosPara", () => {
  it("vocales: solo palabras que empiezan con vocal", () => {
    assert.deepEqual(recursosPara(RECURSOS, "vocales").map((r) => r.id), ["abeja", "elefante", "oso"]);
  });
  it("ordenar: hasta 3 sílabas; completar y contar: hasta 4", () => {
    assert.ok(!recursosPara(RECURSOS, "palabras_silabas").some((r) => r.silabas.length > 3));
    assert.equal(recursosPara(RECURSOS, "completar_silaba").length, RECURSOS.length);
    assert.equal(recursosPara(RECURSOS, "contar_silabas").length, RECURSOS.length);
  });
});

describe("opciones sugeridas", () => {
  it("completar: incluye la sílaba del hueco y dos distintas, ninguna de las que ya se ven en la palabra", () => {
    for (let i = 0; i < 20; i++) {
      const { opciones, correcta } = sugerirOpcionesCompletar(RECURSOS[0], 1, RECURSOS);
      assert.equal(opciones[correcta], "be");
      assert.equal(new Set(opciones).size, 3);
      assert.ok(!opciones.includes("a") && !opciones.includes("ja"), `visibles en ${opciones}`);
    }
  });
  it("completar: sin suficientes sílabas de otras palabras no sugiere", () => {
    assert.equal(sugerirOpcionesCompletar(RECURSOS[0], 1, [RECURSOS[0]]), null);
    assert.equal(sugerirOpcionesCompletar(RECURSOS[0], 9, RECURSOS), null);
  });
  it("contar: tres números seguidos con la cantidad real, sin bajar de 1", () => {
    assert.deepEqual(sugerirOpcionesConteo(RECURSOS[1]).opciones, ["1", "2", "3"]);
    assert.equal(sugerirOpcionesConteo(RECURSOS[1]).correcta, 1);
    assert.deepEqual(sugerirOpcionesConteo(RECURSOS[2]).opciones, ["3", "4", "5"]);
  });
  it("sugerirSegunHabilidad despacha por habilidad y no sugiere para ordenar", () => {
    assert.ok(sugerirSegunHabilidad("vocales", RECURSOS[0]));
    assert.ok(sugerirSegunHabilidad("contar_silabas", RECURSOS[0]));
    assert.ok(sugerirSegunHabilidad("completar_silaba", RECURSOS[0], { indice: 0, recursos: RECURSOS }));
    assert.equal(sugerirSegunHabilidad("palabras_silabas", RECURSOS[0]), null);
  });
});

describe("ejercicioVacio y usaOpciones", () => {
  it("cada habilidad arranca con su consigna y sus campos", () => {
    assert.equal(usaOpciones("palabras_silabas"), false);
    assert.equal(usaOpciones("completar_silaba"), true);
    assert.equal(ejercicioVacio("completar_silaba").indice, 0);
    assert.deepEqual(ejercicioVacio("contar_silabas").opciones, ["", "", ""]);
    assert.equal(ejercicioVacio("palabras_silabas").opciones, undefined);
  });
});

describe("aContrato / aFormulario", () => {
  it("completar: el objetivo lleva el hueco en la posición elegida y el icono sale del catálogo", () => {
    const [e] = aContrato([completar()], "completar_silaba", RECURSOS);
    assert.equal(e.objetivo, "a __ ja");
    assert.equal(e.icono, "🐝");
    assert.equal(e.recursoId, "abeja");
    assert.equal(e.opciones[0].texto, "be");
    assert.equal(e.respuestaCorrectaId, "o1");
  });
  it("contar: el objetivo es la palabra", () => {
    const [e] = aContrato([contar()], "contar_silabas", RECURSOS);
    assert.equal(e.objetivo, "abeja");
    assert.equal(e.respuestaCorrectaId, "o2");
  });
  it("sin icono en el recurso, no se envía", () => {
    const [e] = aContrato([contar({ recursoId: "oso", opciones: ["1", "2", "3"], correcta: 1 })], "contar_silabas", RECURSOS);
    assert.equal("icono" in e, false);
  });
  it("ordenar: piezas del catálogo en el orden correcto", () => {
    const [e] = aContrato([{ recursoId: "gato", consigna: "Ordena", pista: "" }], "palabras_silabas", RECURSOS);
    assert.deepEqual(e.piezas.map((p) => p.texto), ["ga", "to"]);
    assert.deepEqual(e.ordenCorrecto, ["p1", "p2"]);
  });
  it("ida y vuelta: completar conserva la posición del hueco", () => {
    const contrato = aContrato([completar({ indice: 2, opciones: ["ja", "ga", "to"] })], "completar_silaba", RECURSOS);
    assert.equal(aFormulario(contrato)[0].indice, 2);
    assert.equal(aFormulario(contrato)[0].opciones[aFormulario(contrato)[0].correcta], "ja");
  });
  it("una palabra fuera del catálogo se rechaza con un mensaje claro", () => {
    assert.throws(() => aContrato([contar({ recursoId: "dragon" })], "contar_silabas", RECURSOS), /catálogo/);
  });
});

describe("revisar", () => {
  const una = (f, habilidad) => revisar([f], habilidad, RECURSOS)[0];
  it("completar: acepta la sílaba correcta y rechaza otra", () => {
    assert.deepEqual(una(completar(), "completar_silaba"), {});
    assert.match(una(completar({ correcta: 1 }), "completar_silaba").opciones, /sílaba que falta/);
  });
  it("contar: acepta el número correcto y rechaza otro o un texto", () => {
    assert.deepEqual(una(contar(), "contar_silabas"), {});
    assert.match(una(contar({ correcta: 0 }), "contar_silabas").opciones, /número de sílabas/);
    assert.match(una(contar({ opciones: ["dos", "3", "4"] }), "contar_silabas").opciones, /números/);
  });
  it("opciones vacías o repetidas", () => {
    assert.match(una(contar({ opciones: ["2", "", "4"] }), "contar_silabas").opciones, /Completa/);
    assert.match(una(contar({ opciones: ["3", "3", "4"] }), "contar_silabas").opciones, /repetir/);
  });
  it("vocales sigue exigiendo la vocal inicial", () => {
    const f = { recursoId: "abeja", consigna: "¿Con qué vocal?", pista: "", opciones: ["A", "E", "I"], correcta: 1 };
    assert.match(una(f, "vocales").opciones, /vocal/);
    assert.deepEqual(una({ ...f, correcta: 0 }, "vocales"), {});
  });
  it("misma consigna y misma respuesta se marca; otra palabra con el mismo conteo no", () => {
    const repetidos = revisar([contar(), contar()], "contar_silabas", RECURSOS);
    assert.ok(repetidos[1].consigna);
    const distintos = revisar([contar({ recursoId: "gato", opciones: ["1", "2", "3"], correcta: 1 }), contar({ recursoId: "perro", opciones: ["1", "2", "3"], correcta: 1 })], "contar_silabas", RECURSOS);
    assert.deepEqual(distintos, [{}, {}]);
  });
  it("sin palabra elegida", () => {
    assert.ok(una(contar({ recursoId: "" }), "contar_silabas").recursoId);
  });
});

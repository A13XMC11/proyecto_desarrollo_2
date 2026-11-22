const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const Juego = require("../../../../src/lib/Juego/Dominio/Entidades/Juego");
const Ejercicio = require("../../../../src/lib/Juego/Dominio/Entidades/Ejercicio");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const RECURSOS = [
  { id: "abeja", palabra: "abeja", tematica: "animales", silabas: ["a", "be", "ja"], vocalInicial: "a", icono: "🐝" },
  { id: "gato", palabra: "gato", tematica: "animales", silabas: ["ga", "to"], icono: "🐱" },
  { id: "elefante", palabra: "elefante", tematica: "animales", silabas: ["e", "le", "fan", "te"], vocalInicial: "e", icono: "🐘" },
  { id: "oso", palabra: "oso", tematica: "animales", silabas: ["o", "so"], vocalInicial: "o", icono: "🐻" },
  { id: "perro", palabra: "perro", tematica: "animales", silabas: ["pe", "rro"], icono: "🐶" },
  { id: "luna", palabra: "luna", tematica: "naturaleza", silabas: ["lu", "na"], icono: "🌙" }
];
const catalogo = { obtenerRecurso: (id) => RECURSOS.find((r) => r.id === id) };

const opciones = (...textos) => textos.map((t, i) => ({ id: `o${i + 1}`, texto: t }));
const config = (habilidad, cantidadEjercicios = 5) =>
  ({ habilidad, mecanica: "seleccionar_opcion", tematica: "animales", cantidadEjercicios });

// Completar: el objetivo es la palabra por sílabas con «__» en el hueco; una opción es la sílaba que falta
const completar = (id, recursoId, objetivo, textos, correcta, extra = {}) => ({
  id, consigna: "¿Qué sílaba falta?", recursoId, objetivo,
  opciones: opciones(...textos), respuestaCorrectaId: `o${textos.indexOf(correcta) + 1}`, ...extra
});
const contar = (id, recursoId, palabra, textos, correcta, extra = {}) => ({
  id, consigna: "¿Cuántas sílabas tiene?", recursoId, objetivo: palabra,
  opciones: opciones(...textos), respuestaCorrectaId: `o${textos.indexOf(correcta) + 1}`, ...extra
});

const version = (habilidad, ejercicios, cantidad = 5) =>
  new VersionJuego({ juegoId: "j1", configuracion: config(habilidad, cantidad), ejercicios });
const validar = (habilidad, ejercicios) => version(habilidad, ejercicios, 5).validarContenido(catalogo, { exigirCantidad: false });

describe("habilidad completar_silaba", () => {
  it("es compatible con la mecánica seleccionar_opcion y no con ordenar_silabas", () => {
    const base = { docenteId: "d", cursoId: "c", titulo: "Falta una sílaba", habilidad: "completar_silaba", origen: "manual" };
    assert.doesNotThrow(() => new Juego({ ...base, mecanica: "seleccionar_opcion" }));
    assert.throws(() => new Juego({ ...base, mecanica: "ordenar_silabas" }), EntradaInvalida);
  });

  it("acepta una sílaba faltante en cualquier posición", () => {
    assert.doesNotThrow(() => validar("completar_silaba", [
      completar("e1", "abeja", "__ be ja", ["a", "to", "rro"], "a"),
      completar("e2", "abeja", "a __ ja", ["be", "na", "lu"], "be"),
      completar("e3", "elefante", "e le fan __", ["te", "to", "ga"], "te")
    ]));
  });

  it("rechaza un objetivo sin el hueco", () => {
    assert.throws(() => validar("completar_silaba", [completar("e1", "abeja", "a be ja", ["be", "na", "lu"], "be")]), /hueco/);
  });

  it("rechaza un objetivo con más de un hueco", () => {
    assert.throws(() => validar("completar_silaba", [completar("e1", "abeja", "__ __ ja", ["be", "na", "lu"], "be")]), /hueco/);
  });

  it("rechaza si el objetivo no tiene tantas sílabas como la palabra", () => {
    assert.throws(() => validar("completar_silaba", [completar("e1", "abeja", "a __", ["be", "na", "lu"], "be")]), /sílabas/);
  });

  it("rechaza si las sílabas visibles no son las de la palabra", () => {
    assert.throws(() => validar("completar_silaba", [completar("e1", "abeja", "a __ xx", ["be", "na", "lu"], "be")]), /sílabas/);
  });

  it("rechaza una respuesta correcta que no es la sílaba que falta", () => {
    assert.throws(() => validar("completar_silaba", [completar("e1", "abeja", "a __ ja", ["be", "na", "lu"], "na")]), /sílaba que falta/);
  });

  it("rechaza la sílaba faltante repetida como distractor", () => {
    assert.throws(() => validar("completar_silaba", [completar("e1", "abeja", "a __ ja", ["be", "BE", "lu"], "be")]), /duplicado/);
  });

  it("rechaza una consigna que nombra la palabra completa", () => {
    assert.throws(() => validar("completar_silaba", [
      completar("e1", "abeja", "a __ ja", ["be", "na", "lu"], "be", { consigna: "Completa la palabra abeja" })
    ]), /consigna contiene la respuesta/);
  });

  it("rechaza un recurso que no existe o de otra temática", () => {
    assert.throws(() => validar("completar_silaba", [completar("e1", "dragon", "a __ ja", ["be", "na", "lu"], "be")]), /no existe/);
    assert.throws(() => validar("completar_silaba", [completar("e1", "luna", "__ na", ["lu", "to", "rro"], "lu")]), /temática/);
  });

  it("misma consigna con otra palabra no cuenta como repetida; la misma palabra y sílaba sí", () => {
    assert.doesNotThrow(() => validar("completar_silaba", [
      completar("e1", "abeja", "a __ ja", ["be", "na", "lu"], "be"),
      completar("e2", "gato", "ga __", ["to", "na", "lu"], "to")
    ]));
    assert.throws(() => validar("completar_silaba", [
      completar("e1", "abeja", "a __ ja", ["be", "na", "lu"], "be"),
      completar("e2", "abeja", "a __ ja", ["be", "na", "lu"], "be")
    ]), /repetidas/);
  });
});

describe("habilidad contar_silabas", () => {
  it("es compatible con seleccionar_opcion", () => {
    assert.doesNotThrow(() => new Juego({ docenteId: "d", cursoId: "c", titulo: "Cuenta sílabas", habilidad: "contar_silabas", mecanica: "seleccionar_opcion", origen: "manual" }));
  });

  it("acepta el número correcto de sílabas entre las opciones", () => {
    assert.doesNotThrow(() => validar("contar_silabas", [
      contar("e1", "abeja", "abeja", ["2", "3", "4"], "3"),
      contar("e2", "gato", "gato", ["1", "2", "3"], "2"),
      contar("e3", "elefante", "elefante", ["3", "4", "5"], "4")
    ]));
  });

  it("rechaza un conteo incorrecto como respuesta", () => {
    assert.throws(() => validar("contar_silabas", [contar("e1", "abeja", "abeja", ["2", "3", "4"], "4")]), /sílabas/);
  });

  it("rechaza opciones que no son números enteros", () => {
    assert.throws(() => validar("contar_silabas", [contar("e1", "abeja", "abeja", ["dos", "3", "4"], "3")]), /número/);
  });

  it("rechaza que el objetivo no sea la palabra", () => {
    assert.throws(() => validar("contar_silabas", [contar("e1", "abeja", "gato", ["2", "3", "4"], "3")]), /objetivo/);
  });

  it("rechaza una consigna que nombra la palabra", () => {
    assert.throws(() => validar("contar_silabas", [contar("e1", "abeja", "abeja", ["2", "3", "4"], "3", { consigna: "¿Cuántas sílabas tiene abeja?" })]), /consigna contiene la respuesta/);
  });

  it("dos palabras con la misma consigna y el mismo conteo no son repetidas", () => {
    assert.doesNotThrow(() => validar("contar_silabas", [
      contar("e1", "gato", "gato", ["1", "2", "3"], "2"),
      contar("e2", "perro", "perro", ["1", "2", "3"], "2")
    ]));
  });
});

describe("icono del ejercicio", () => {
  it("Ejercicio acepta un emoji y rechaza texto", () => {
    assert.equal(new Ejercicio({ id: "e1", consigna: "Hola", icono: "🐝" }).icono, "🐝");
    assert.equal(new Ejercicio({ id: "e1", consigna: "Hola" }).icono, undefined);
    assert.throws(() => new Ejercicio({ id: "e1", consigna: "Hola", icono: "abeja" }), EntradaInvalida);
  });

  it("se reconoce como campo del contrato", () => {
    assert.doesNotThrow(() => VersionJuego.rechazarCamposDesconocidos([{ id: "e1", consigna: "x", icono: "🐝" }]));
  });

  it("debe coincidir con el icono del recurso", () => {
    const bien = completar("e1", "abeja", "a __ ja", ["be", "na", "lu"], "be", { icono: "🐝" });
    assert.doesNotThrow(() => validar("completar_silaba", [bien]));
    assert.throws(() => validar("completar_silaba", [{ ...bien, icono: "🐱" }]), /icono/);
  });

  it("es opcional y un recurso sin icono no lo admite", () => {
    assert.doesNotThrow(() => validar("contar_silabas", [contar("e1", "abeja", "abeja", ["2", "3", "4"], "3")]));
    const sinIcono = { ...RECURSOS[0], id: "sinicono", icono: undefined };
    const cat = { obtenerRecurso: (id) => (id === "sinicono" ? sinIcono : catalogo.obtenerRecurso(id)) };
    const e = contar("e1", "sinicono", "abeja", ["2", "3", "4"], "3", { icono: "🐝" });
    assert.throws(() => version("contar_silabas", [e]).validarContenido(cat, { exigirCantidad: false }), /icono/);
  });

  it("también se comprueba en ordenar sílabas y en vocales", () => {
    const silabas = {
      id: "e1", consigna: "Ordena", palabraId: "gato", icono: "🐶",
      piezas: [{ id: "p1", texto: "ga" }, { id: "p2", texto: "to" }], ordenCorrecto: ["p1", "p2"]
    };
    const v = new VersionJuego({ juegoId: "j", configuracion: { habilidad: "palabras_silabas", mecanica: "ordenar_silabas", tematica: "animales", cantidadEjercicios: 5 }, ejercicios: [silabas] });
    assert.throws(() => v.validarContenido(catalogo, { exigirCantidad: false }), /icono/);
    const vocal = {
      id: "e1", consigna: "¿Con qué vocal?", recursoId: "oso", objetivo: "oso", icono: "🐼",
      opciones: opciones("a", "o", "u"), respuestaCorrectaId: "o2"
    };
    assert.throws(() => validar("vocales", [vocal]), /icono/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aContratoLibre, aFormularioLibre, iconosDe, palabraDe, respuestaDe, revisarLibre } from "./EjerciciosLibres.js";
import { aVistaPrevia, esCorrecta } from "./VistaPrevia.js";
import { etiquetaTematica, nombreTematica } from "./Tematica.js";

// Ejercicios con la forma exacta que entrega el servidor para la temática libre (sin recursoId)
const vocales = { id: "e1", consigna: "¿Con qué vocal empieza esta palabra?", pista: "Escucha el primer sonido", objetivo: "uva", icono: "🍇", opciones: [{ id: "o1", texto: "A" }, { id: "o2", texto: "I" }, { id: "o3", texto: "U" }], respuestaCorrectaId: "o3" };
const contar = { id: "e2", consigna: "¿Cuántas sílabas tiene la palabra?", objetivo: "azul", opciones: [{ id: "o1", texto: "1" }, { id: "o2", texto: "2" }, { id: "o3", texto: "3" }], respuestaCorrectaId: "o2" };
const completar = { id: "e3", consigna: "¿Qué sílaba falta?", objetivo: "ma __ na", palabraId: "manzana", icono: "🍎", opciones: [{ id: "o1", texto: "zan" }, { id: "o2", texto: "bi" }, { id: "o3", texto: "su" }], respuestaCorrectaId: "o1" };
const ordenar = { id: "e4", consigna: "Ordena las sílabas", palabraId: "amarillo", piezas: [{ id: "p1", texto: "a" }, { id: "p2", texto: "ma" }, { id: "p3", texto: "ri" }], ordenCorrecto: ["p1", "p2", "p3"] };
const TODOS = [vocales, contar, completar, ordenar];

describe("palabraDe y respuestaDe", () => {
  it("la palabra sale de palabraId si existe y, si no, del objetivo", () => {
    assert.deepEqual(TODOS.map(palabraDe), ["uva", "azul", "manzana", "amarillo"]);
  });
  it("la respuesta se lee como texto para que el docente la revise", () => {
    assert.deepEqual(TODOS.map(respuestaDe), ["U", "2", "zan", "a-ma-ri"]);
  });
});

describe("aFormularioLibre", () => {
  it("conserva consigna, pista e icono, y deja lo ausente como cadena vacía", () => {
    const f = aFormularioLibre(TODOS);
    assert.deepEqual(f.map((x) => x.icono), ["🍇", "", "🍎", ""]);
    assert.deepEqual(f.map((x) => x.pista), ["Escucha el primer sonido", "", "", ""]);
    assert.equal(f[0].palabra, "uva");
  });
  it("una lista vacía o ausente no rompe", () => {
    assert.deepEqual(aFormularioLibre([]), []);
    assert.deepEqual(aFormularioLibre(undefined), []);
  });
});

describe("aContratoLibre: solo cambian consigna, pista e icono", () => {
  it("sin cambios devuelve exactamente los mismos ejercicios", () => {
    assert.deepEqual(aContratoLibre(aFormularioLibre(TODOS), TODOS), TODOS);
  });

  it("corregir la consigna y la pista; la palabra, las opciones y las respuestas no se tocan", () => {
    const f = aFormularioLibre(TODOS);
    f[0] = { ...f[0], consigna: "  ¿Con cuál vocal empieza?  ", pista: " Suena fuerte " };
    f[2] = { ...f[2], palabra: "OTRA", consigna: "¿Cuál falta?" }; // la palabra del formulario no se usa
    const salida = aContratoLibre(f, TODOS);
    assert.equal(salida[0].consigna, "¿Con cuál vocal empieza?");
    assert.equal(salida[0].pista, "Suena fuerte");
    for (const [i, original] of TODOS.entries()) {
      for (const campo of ["id", "objetivo", "palabraId", "opciones", "respuestaCorrectaId", "piezas", "ordenCorrecto"]) {
        assert.deepEqual(salida[i][campo], original[campo], `${campo} del ejercicio ${i + 1}`);
      }
    }
    assert.equal(salida[2].consigna, "¿Cuál falta?");
  });

  it("quitar el icono lo elimina del contrato; poner uno lo agrega; vaciar la pista la elimina", () => {
    const f = aFormularioLibre(TODOS);
    f[0] = { ...f[0], icono: "", pista: "" };
    f[1] = { ...f[1], icono: "🔢" };
    const salida = aContratoLibre(f, TODOS);
    assert.equal("icono" in salida[0], false);
    assert.equal("pista" in salida[0], false);
    assert.equal(salida[1].icono, "🔢");
  });

  it("no modifica los originales", () => {
    const copia = structuredClone(TODOS);
    const f = aFormularioLibre(TODOS);
    f[0].consigna = "otra";
    aContratoLibre(f, TODOS);
    assert.deepEqual(TODOS, copia);
  });
});

describe("revisarLibre", () => {
  it("una consigna vacía o demasiado larga y una pista demasiado larga se marcan", () => {
    const f = aFormularioLibre(TODOS);
    f[0].consigna = "   ";
    f[1].consigna = "x".repeat(141);
    f[2].pista = "y".repeat(101);
    const errores = revisarLibre(f);
    assert.match(errores[0].consigna, /vacía/);
    assert.match(errores[1].consigna, /140/);
    assert.match(errores[2].pista, /100/);
    assert.deepEqual(errores[3], {});
  });
  it("lo que viene del servidor está bien", () => {
    assert.deepEqual(revisarLibre(aFormularioLibre(TODOS)), [{}, {}, {}, {}]);
  });
});

describe("iconosDe", () => {
  const categorias = [{ clave: "frutas", iconos: ["🍎", "🍐"] }, { clave: "animales", iconos: ["🐱"] }];
  it("devuelve los iconos de una categoría y, sin categoría, todos", () => {
    assert.deepEqual(iconosDe(categorias, "frutas"), ["🍎", "🍐"]);
    assert.deepEqual(iconosDe(categorias, ""), ["🍎", "🍐", "🐱"]);
    assert.deepEqual(iconosDe(categorias, "no-existe"), []);
    assert.deepEqual(iconosDe(undefined, "frutas"), []);
  });
});

describe("vista previa con contenido libre", () => {
  it("las cuatro habilidades se pueden probar, también con el icono ausente", () => {
    const previa = aVistaPrevia(TODOS);
    assert.deepEqual(previa.map((e) => e.tipo), ["seleccionar_opcion", "seleccionar_opcion", "seleccionar_opcion", "ordenar_silabas"]);
    assert.equal(previa[1].icono, undefined);
    assert.equal(previa[3].icono, undefined);
    assert.equal(previa[3].objetivo, undefined);
    assert.ok(esCorrecta(previa[0], "o3") && !esCorrecta(previa[0], "o1"));
    assert.ok(esCorrecta(previa[3], ["p1", "p2", "p3"]) && !esCorrecta(previa[3], ["p3", "p2", "p1"]));
  });
  it("las piezas nunca quedan ya ordenadas", () => {
    for (let i = 0; i < 30; i += 1) assert.notDeepEqual(aVistaPrevia([ordenar])[0].piezas.map((p) => p.id), ["p1", "p2", "p3"]);
  });
});

describe("nombreTematica y etiquetaTematica", () => {
  it("una temática libre se distingue; una del catálogo conserva su nombre", () => {
    assert.equal(nombreTematica({ modoTematica: "libre", tematica: "frutas" }), "Temática libre: frutas");
    assert.equal(nombreTematica({ modoTematica: "catalogo", tematica: "animales" }), "Animales");
    assert.equal(nombreTematica({ tematica: "cuerpo" }), "Cuerpo humano", "sin modo es del catálogo (datos antiguos)");
    assert.equal(nombreTematica(undefined), "");
  });
  it("la etiqueta de la biblioteca solo existe para las libres", () => {
    assert.equal(etiquetaTematica({ modoTematica: "libre", tematica: "colores" }), "Temática libre: colores");
    assert.equal(etiquetaTematica({ modoTematica: "catalogo", tematica: "animales" }), null);
    assert.equal(etiquetaTematica(undefined), null);
  });
});

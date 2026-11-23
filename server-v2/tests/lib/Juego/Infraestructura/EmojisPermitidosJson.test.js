const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const EmojisPermitidosJson = require("../../../../src/lib/Juego/Infraestructura/EmojisPermitidosJson");
const IEmojisPermitidos = require("../../../../src/lib/Juego/Dominio/Ports/IEmojisPermitidos");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");
const { icono } = require("../../../../src/lib/Compartido/Dominio/Validaciones");
const datos = require("../../../../src/lib/Juego/Infraestructura/emojis/emojisPermitidos.json");
const catalogo = require("../../../../src/lib/Juego/Infraestructura/catalogo/learning-resources.json");

const CATEGORIAS = ["animales", "frutas", "verduras", "objetos", "naturaleza", "cuerpo", "escuela", "comida", "transporte", "juguetes"];
// Cuadrados y círculos de color: un icono así solo se distingue por el color
const MUESTRAS_DE_COLOR = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜", "◼️", "◻️", "◾", "◽", "▪️", "▫️", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻"];
// Nada que dé miedo, armas, drogas, alcohol, tabaco, medicinas, religión o banderas
const NO_SEGUROS = ["🔪", "🗡️", "⚔️", "🔫", "💣", "🧨", "🏹", "🪓", "⛏️", "🍺", "🍻", "🍷", "🍸", "🍹", "🥃", "🍾", "🚬", "💊", "💉", "🩸", "💀", "☠️", "👻", "👽", "😈", "👿", "🧟", "🧛", "🕷️", "🦂", "🦟", "🍑", "🍆", "🔥", "⛪", "🕌", "🕍", "✝️", "☪️", "🕉️", "☮️", "🏳️", "🏴", "🚩", "🎰", "🔞", "💩"];

const todos = Object.values(datos.categorias).flat();
const sinVariante = (e) => e.replace(/️/g, "");

describe("emojisPermitidos.json: lista cerrada y revisable", () => {
  const lista = new EmojisPermitidosJson();

  it("tiene las 10 categorías, en este orden, y cada una con varios iconos", () => {
    assert.deepEqual(Object.keys(datos.categorias), CATEGORIAS);
    for (const [categoria, emojis] of Object.entries(datos.categorias)) {
      assert.ok(Array.isArray(emojis) && emojis.length >= 10, `${categoria} debería tener al menos 10 iconos`);
    }
    assert.ok(todos.length >= 200, `la lista es amplia (${todos.length})`);
  });

  it("documenta qué es, qué se excluye y cómo editarla", () => {
    assert.equal(typeof datos.meta.descripcion, "string");
    assert.match(datos.meta.excluidos, /color/i);
    assert.match(datos.meta.excluidos, /arma/i);
    assert.equal(typeof datos.meta.comoEditar, "string");
    assert.match(datos.meta.revision, /docente/i);
  });

  it("cada icono es un emoji válido y corto (el mismo criterio que usa el ejercicio)", () => {
    for (const emoji of todos) assert.doesNotThrow(() => icono(emoji, "icono"), emoji);
  });

  it("sin repetidos, dentro de una categoría ni entre categorías", () => {
    const vistos = new Map();
    for (const [categoria, emojis] of Object.entries(datos.categorias)) {
      for (const emoji of emojis) {
        const clave = sinVariante(emoji);
        assert.equal(vistos.has(clave), false, `${emoji} está en ${categoria} y en ${vistos.get(clave)}`);
        vistos.set(clave, categoria);
      }
    }
  });

  it("no hay cuadrados ni círculos de color: ningún icono depende solo del color", () => {
    for (const color of MUESTRAS_DE_COLOR) assert.equal(lista.esPermitido(color), false, color);
  });

  it("no hay armas, miedo, alcohol, drogas, religión ni nada inseguro", () => {
    for (const malo of NO_SEGUROS) assert.equal(lista.esPermitido(malo), false, malo);
  });

  it("incluye los iconos del catálogo revisado (el modo libre no pierde ninguno)", () => {
    for (const r of catalogo.recursos) {
      if (r.icono) assert.equal(lista.esPermitido(r.icono), true, `${r.palabra} ${r.icono}`);
    }
  });

  it("incluye iconos de frutas, colores de uso diario, animales y transporte", () => {
    for (const emoji of ["🍎", "🍌", "🍇", "🍓", "🥭", "🐶", "🐱", "🐮", "🐴", "🐸", "🚗", "🚌", "🚲", "✈️", "🚢", "🚂", "🏠", "📚", "⚽", "🧸", "🌈"]) {
      assert.equal(lista.esPermitido(emoji), true, emoji);
    }
  });
});

describe("EmojisPermitidosJson (adaptador del puerto IEmojisPermitidos)", () => {
  const lista = new EmojisPermitidosJson();

  it("cumple el puerto", () => {
    assert.equal(typeof new IEmojisPermitidos().esPermitido, "function");
    assert.equal(typeof lista.esPermitido, "function");
  });

  it("acepta un emoji con o sin selector de variante", () => {
    assert.equal(lista.esPermitido("✏️"), true);
    assert.equal(lista.esPermitido("✏"), true);
    assert.equal(lista.esPermitido("❤️"), true);
    assert.equal(lista.esPermitido("❤"), true);
  });

  it("rechaza lo que no es un único icono de la lista", () => {
    for (const malo of ["", " ", "abc", "🐶🐱", "🐶 ", "x🐶", undefined, null, 5, {}, [], "🇪🇨", "<b>"]) {
      assert.equal(lista.esPermitido(malo), false, String(malo));
    }
  });

  it("rechaza listas mal armadas al cargar", () => {
    const con = (categorias) => () => new EmojisPermitidosJson({ categorias });
    const base = Object.fromEntries(CATEGORIAS.map((c, i) => [c, [String.fromCodePoint(0x1f600 + i)]]));
    assert.doesNotThrow(con(base));
    assert.throws(() => new EmojisPermitidosJson(null), EntradaInvalida);
    assert.throws(() => new EmojisPermitidosJson({}), EntradaInvalida);
    const { juguetes, ...sinUna } = base;
    assert.throws(con(sinUna), EntradaInvalida);
    assert.throws(con({ ...base, inventada: ["🐶"] }), EntradaInvalida);
    assert.throws(con({ ...base, animales: ["abc"] }), EntradaInvalida, "no es un emoji");
    assert.throws(con({ ...base, animales: [""] }), EntradaInvalida);
    assert.throws(con({ ...base, animales: ["🔴"] }), EntradaInvalida, "un color suelto");
    assert.throws(con({ ...base, animales: ["🐶"], frutas: ["🐶"] }), EntradaInvalida, "repetido entre categorías");
    assert.throws(con({ ...base, animales: ["🐶", "🐶"] }), EntradaInvalida, "repetido en la categoría");
  });

  it("categorias() entrega la lista agrupada, en el orden de la revisión, para que el cliente deje elegir un icono", () => {
    const grupos = lista.categorias();
    assert.deepEqual(grupos.map((g) => g.clave), IEmojisPermitidos.CATEGORIAS);
    for (const { iconos } of grupos) {
      assert.ok(iconos.length > 0);
      assert.ok(iconos.every((icono) => lista.esPermitido(icono)));
    }
    const todos = grupos.flatMap((g) => g.iconos);
    assert.equal(new Set(todos).size, todos.length, "sin repetidos");
    assert.ok(todos.includes("🍎") && !todos.includes("🔪"));
  });

  it("categorias() no deja modificar la lista por dentro", () => {
    const grupos = lista.categorias();
    grupos[0].iconos.push("🔪");
    grupos.pop();
    assert.equal(lista.esPermitido("🔪"), false);
    assert.equal(lista.categorias().length, IEmojisPermitidos.CATEGORIAS.length);
  });
});

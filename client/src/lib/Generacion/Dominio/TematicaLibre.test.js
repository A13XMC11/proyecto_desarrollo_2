import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EJEMPLOS_TEMATICA, MAX_TEMATICA, MIN_TEMATICA, ayudaTematica, normalizarTematica, revisarTematica } from "./TematicaLibre.js";

// Espejo de la validación de FORMA del servidor (largo y letras). El filtro de contenido NO se replica aquí: lo decide el servidor.
describe("revisarTematica", () => {
  it("acepta letras del español y espacios, de 3 a 40 caracteres", () => {
    for (const texto of ["frutas", "colores", "sonidos de animales", "medios de transporte", "canción", "ñandú y pingüino", "abc", "a".repeat(40)]) {
      assert.equal(revisarTematica(texto), null, texto);
    }
  });

  it("rechaza vacío, corto y largo con un mensaje que lo explica", () => {
    assert.match(revisarTematica(""), /Escribe/);
    assert.match(revisarTematica("   "), /Escribe/);
    assert.match(revisarTematica("ab"), new RegExp(String(MIN_TEMATICA)));
    assert.match(revisarTematica("a".repeat(41)), new RegExp(String(MAX_TEMATICA)));
  });

  it("rechaza números, signos, símbolos, marcado y saltos de línea", () => {
    for (const texto of ["frutas 2", "frutas!", "fru-tas", "<b>frutas</b>", "frutas\ncolores", "frutas\tcolores", "💡 ideas", "a@b.com", "https://x.com"]) {
      assert.match(revisarTematica(texto) || "", /letras/, JSON.stringify(texto));
    }
  });

  it("ignora los espacios de más, igual que el servidor (se juntan y se recortan)", () => {
    assert.equal(revisarTematica("  sonidos   de animales  "), null);
    assert.equal(revisarTematica("  ab  "), revisarTematica("ab"));
  });

  it("el mensaje nunca repite lo que se escribió", () => {
    for (const texto of ["frutas 2", "pistola!!!", "x".repeat(60)]) assert.ok(!(revisarTematica(texto) || "").includes(texto.trim()));
  });

  it("si no hay texto, lo trata como vacío", () => {
    for (const valor of [undefined, null]) assert.match(revisarTematica(valor), /Escribe/);
  });
});

describe("normalizarTematica", () => {
  it("minúsculas, un espacio entre palabras y sin espacios en los bordes", () => {
    assert.equal(normalizarTematica("  Sonidos   DE Animales "), "sonidos de animales");
    assert.equal(normalizarTematica(undefined), "");
  });
});

describe("ayudaTematica", () => {
  it("«sonidos de animales» avisa que se practicará con los nombres de los animales", () => {
    for (const texto of ["sonidos de animales", "Sonidos de los animales", "  SONIDO animal "]) {
      assert.match(ayudaTematica(texto), /nombres de los animales/, texto);
    }
  });
  it("otras temáticas no llevan ayuda", () => {
    for (const texto of ["frutas", "animales", "sonidos", "colores", ""]) assert.equal(ayudaTematica(texto), null, texto);
  });
});

describe("ejemplos", () => {
  it("son los cuatro pedidos y todos tienen forma válida", () => {
    assert.deepEqual(EJEMPLOS_TEMATICA, ["frutas", "colores", "sonidos de animales", "medios de transporte"]);
    for (const e of EJEMPLOS_TEMATICA) assert.equal(revisarTematica(e), null);
  });
});

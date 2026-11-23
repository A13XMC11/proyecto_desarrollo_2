const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");
const { MODOS_TEMATICA, TEMATICAS } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");
const { tematicaLibre } = require("../../../../src/lib/Compartido/Dominio/Validaciones");

describe("ValoresPermitidos: modos de temática", () => {
  it("hay dos modos, catálogo y libre, y la lista del catálogo no cambia", () => {
    assert.deepEqual(MODOS_TEMATICA, ["catalogo", "libre"]);
    assert.deepEqual(TEMATICAS, ["animales", "objetos_cotidianos", "naturaleza", "cuerpo", "escuela"]);
  });

  it("el espejo del cliente declara los mismos modos", (t) => {
    const archivo = path.resolve(__dirname, "../../../../../client/src/lib/Juego/Dominio/ValoresPermitidos.js");
    if (!fs.existsSync(archivo)) return t.skip("no está la carpeta del cliente junto al servidor");
    const codigo = fs.readFileSync(archivo, "utf8");
    const bloque = codigo.match(/export const MODOS_TEMATICA = \{([\s\S]*?)\};/);
    assert.ok(bloque, "el cliente no declara MODOS_TEMATICA");
    const claves = [...bloque[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]);
    assert.deepEqual(claves, MODOS_TEMATICA);
  });
});

describe("Validaciones.tematicaLibre", () => {
  it("devuelve el texto normalizado: recortado, en minúsculas y con un solo espacio entre palabras", () => {
    assert.equal(tematicaLibre("  Sonidos   de ANIMALES ", "tematica"), "sonidos de animales");
    assert.equal(tematicaLibre("Frutas", "tematica"), "frutas");
    assert.equal(tematicaLibre("Medios de transporte", "tematica"), "medios de transporte");
  });

  it("acepta solo letras del español y espacios, con tildes, ñ y ü", () => {
    assert.equal(tematicaLibre("Cuerpo humano ñandú pingüino", "t"), "cuerpo humano ñandú pingüino");
    assert.equal(tematicaLibre("Árboles y más", "t"), "árboles y más");
    assert.equal(tematicaLibre("árboles", "t"), "árboles", "una tilde en dos partes (NFD) se normaliza");
  });

  it("acepta de 3 a 40 caracteres, contados después de normalizar", () => {
    assert.equal(tematicaLibre("uvs", "t"), "uvs");
    assert.equal(tematicaLibre("a".repeat(40), "t"), "a".repeat(40));
    assert.equal(tematicaLibre("  " + "b".repeat(40) + "  ", "t"), "b".repeat(40));
    assert.throws(() => tematicaLibre("ab", "t"), EntradaInvalida);
    assert.throws(() => tematicaLibre("a".repeat(41), "t"), EntradaInvalida);
    assert.equal(tematicaLibre("a   b", "t"), "a b", "se cuenta después de colapsar los espacios: 'a b' tiene 3");
    assert.throws(() => tematicaLibre("a    ", "t"), EntradaInvalida, "recortado queda en 1 carácter");
  });

  it("rechaza números, símbolos, HTML, URL, correos, guiones y saltos de línea", () => {
    for (const malo of ["animales2", "2 animales", "frutas!", "frutas, verduras", "<b>frutas</b>", "frutas.com", "a@b.co",
      "https://x.ec", "frutas-verduras", "frutas\nverduras", "frutas\tverduras", "😀 frutas", "frutas_y_más", "uno/otro"]) {
      assert.throws(() => tematicaLibre(malo, "t"), EntradaInvalida, JSON.stringify(malo));
    }
  });

  it("rechaza lo que no es texto o está vacío", () => {
    for (const malo of [undefined, null, "", "   ", 42, {}, [], true]) {
      assert.throws(() => tematicaLibre(malo, "t"), EntradaInvalida, String(malo));
    }
  });

  it("el mensaje nombra el campo y no repite el texto recibido", () => {
    assert.throws(() => tematicaLibre("zzz999", "tematica"), (e) => e instanceof EntradaInvalida && e.message.includes("tematica") && !e.message.includes("zzz999"));
  });
});

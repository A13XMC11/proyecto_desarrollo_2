const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const CatalogoRecursosJson = require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const { TEMATICAS } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");

const VOCALES = ["a", "e", "i", "o", "u"];
const normalizar = (t) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const recurso = (extra = {}) => ({ id: "gato", palabra: "gato", tematica: "animales", silabas: ["ga", "to"], ...extra });
const catalogoCon = (...recursos) => new CatalogoRecursosJson({ recursos });

describe("CatalogoRecursosJson: catálogo inicial", () => {
  const catalogo = new CatalogoRecursosJson();
  const todos = catalogo.listar();

  it("tiene entre 15 y 25 recursos con ids únicos", () => {
    assert.ok(todos.length >= 15 && todos.length <= 25, `hay ${todos.length}`);
    assert.equal(new Set(todos.map((r) => r.id)).size, todos.length);
  });

  it("cada recurso es coherente: las sílabas forman la palabra y la vocal inicial es la primera letra", () => {
    for (const r of todos) {
      assert.ok(TEMATICAS.includes(r.tematica), r.id);
      assert.equal(normalizar(r.silabas.join("")), normalizar(r.palabra), r.id);
      assert.ok(r.silabas.length >= 2 && r.silabas.every((s) => s.length <= 10), r.id);
      const primera = normalizar(r.palabra)[0];
      if (VOCALES.includes(primera)) assert.equal(r.vocalInicial, primera, `${r.id} debe declarar su vocal inicial`);
      else assert.equal(r.vocalInicial, undefined, `${r.id} no empieza con vocal`);
    }
  });

  it("cada temática tiene las cinco vocales (para 5 ejercicios de vocales sin repetir respuesta) y palabras para ordenar", () => {
    for (const tematica of TEMATICAS) {
      const deTema = catalogo.listar({ tematica });
      const vocales = new Set(deTema.map((r) => r.vocalInicial).filter(Boolean));
      assert.deepEqual([...vocales].sort(), VOCALES, tematica);
      assert.ok(deTema.length >= 5, tematica);
    }
  });

  it("obtenerRecurso devuelve el recurso o undefined", () => {
    assert.equal(catalogo.obtenerRecurso("oso").palabra, "oso");
    assert.equal(catalogo.obtenerRecurso("no-existe"), undefined);
    assert.equal(catalogo.obtenerRecurso(undefined), undefined);
  });

  it("listar filtra por temática y rechaza una desconocida", () => {
    assert.ok(catalogo.listar({ tematica: "animales" }).every((r) => r.tematica === "animales"));
    assert.throws(() => catalogo.listar({ tematica: "espacio" }));
  });

  it("devuelve copias: modificar el resultado no altera el catálogo", () => {
    const r = catalogo.obtenerRecurso("oso");
    r.silabas.push("x");
    r.palabra = "otra";
    assert.deepEqual(catalogo.obtenerRecurso("oso").silabas, ["o", "so"]);
    assert.equal(catalogo.obtenerRecurso("oso").palabra, "oso");
  });

  it("sirve para validar contenido de ambas mecánicas en cada temática", () => {
    for (const tematica of TEMATICAS) {
      const deTema = catalogo.listar({ tematica });
      const conVocal = VOCALES.map((v) => deTema.find((r) => r.vocalInicial === v));
      const vocales = conVocal.map((r, i) => ({
        id: `e${i + 1}`, consigna: "¿Con qué vocal empieza esta palabra?", recursoId: r.id,
        opciones: VOCALES.filter((v) => v !== r.vocalInicial).slice(0, 2).concat(r.vocalInicial).map((t) => ({ id: `o-${t}`, texto: t })),
        respuestaCorrectaId: `o-${r.vocalInicial}`
      }));
      const v1 = new VersionJuego({ juegoId: "j", configuracion: { habilidad: "vocales", mecanica: "seleccionar_opcion", tematica, cantidadEjercicios: 5 }, ejercicios: vocales });
      assert.doesNotThrow(() => v1.validarContenido(catalogo), tematica);

      const silabas = deTema.slice(0, 5).map((r, i) => ({
        id: `e${i + 1}`, consigna: "Ordena las sílabas", palabraId: r.id,
        piezas: r.silabas.map((t, j) => ({ id: `p${j + 1}`, texto: t })), ordenCorrecto: r.silabas.map((_, j) => `p${j + 1}`)
      }));
      const v2 = new VersionJuego({ juegoId: "j", configuracion: { habilidad: "palabras_silabas", mecanica: "ordenar_silabas", tematica, cantidadEjercicios: 5 }, ejercicios: silabas });
      assert.doesNotThrow(() => v2.validarContenido(catalogo), tematica);
    }
  });
});

describe("CatalogoRecursosJson: rechaza un catálogo incoherente al cargar", () => {
  it("ids repetidos", () => assert.throws(() => catalogoCon(recurso(), recurso()), /repetido/));
  it("temática desconocida", () => assert.throws(() => catalogoCon(recurso({ tematica: "espacio" })), /temática/));
  it("sílabas que no forman la palabra", () => assert.throws(() => catalogoCon(recurso({ silabas: ["ga", "ta"] })), /sílabas/));
  it("una sola sílaba", () => assert.throws(() => catalogoCon(recurso({ id: "sol", palabra: "sol", silabas: ["sol"] })), /sílabas/));
  it("palabra con vocal inicial sin declararla", () => assert.throws(() => catalogoCon(recurso({ id: "oso", palabra: "oso", silabas: ["o", "so"] })), /vocal/));
  it("vocal inicial que no coincide", () => assert.throws(() => catalogoCon(recurso({ id: "oso", palabra: "oso", silabas: ["o", "so"], vocalInicial: "a" })), /vocal/));
  it("vocal inicial declarada en una palabra con consonante", () => assert.throws(() => catalogoCon(recurso({ vocalInicial: "a" })), /vocal/));
  it("sin lista de recursos", () => assert.throws(() => new CatalogoRecursosJson({}), /recursos/));
});

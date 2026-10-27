const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Juego = require("../../../../src/lib/Juego/Dominio/Entidades/Juego");
const Ejercicio = require("../../../../src/lib/Juego/Dominio/Entidades/Ejercicio");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const juego = {
  docenteId: "d1", cursoId: "c1", titulo: "Las vocales", habilidad: "vocales",
  mecanica: "seleccionar_opcion", origen: "manual"
};
const opcion = (id) => ({ id, texto: id, recursoId: `r-${id}` });
const ejSeleccion = (id = "e1") => ({
  id, consigna: "¿Con qué vocal empieza?", pista: "Escucha", opciones: [opcion("a"), opcion("e"), opcion("i")],
  respuestaCorrectaId: "a"
});
const ejOrden = (id = "e1") => ({
  id, consigna: "Ordena", palabraId: "gato", piezas: [{ id: "p1", texto: "ga" }, { id: "p2", texto: "to" }],
  ordenCorrecto: ["p1", "p2"]
});
const cfg = (habilidad, mecanica) => ({ habilidad, mecanica, tematica: "animales", cantidadEjercicios: 5 });

describe("Entidad Juego", () => {
  it("crea un borrador sin versión actual", () => {
    const j = new Juego(juego);
    assert.equal(j.estado, "borrador");
    assert.equal(j.versionActualId, null);
  });

  it("rechaza datos inválidos", () => {
    for (const malo of [
      { ...juego, titulo: "ab" },
      { ...juego, titulo: "x".repeat(81) },
      { ...juego, titulo: "<b>hola</b>" },
      { ...juego, habilidad: "otra" },
      { ...juego, mecanica: "ordenar_silabas" },
      { ...juego, origen: "robot" },
      { ...juego, estado: "x" },
      { ...juego, origen: "ia" },
      { ...juego, cursoId: undefined }
    ]) {
      assert.throws(() => new Juego(malo), EntradaInvalida);
    }
    assert.ok(new Juego({ ...juego, origen: "ia", generacionId: "g1" }));
  });
});

describe("Entidad Ejercicio", () => {
  it("acepta ejercicios válidos de ambas mecánicas", () => {
    assert.equal(new Ejercicio(ejSeleccion()).tipo, "seleccionar_opcion");
    assert.equal(new Ejercicio(ejOrden()).tipo, "ordenar_silabas");
  });

  it("rechaza consigna o pista largas, o con URLs", () => {
    assert.throws(() => new Ejercicio({ ...ejSeleccion(), consigna: "x".repeat(141) }), EntradaInvalida);
    assert.throws(() => new Ejercicio({ ...ejSeleccion(), pista: "x".repeat(101) }), EntradaInvalida);
    assert.throws(() => new Ejercicio({ ...ejSeleccion(), pista: "mira http://x.com" }), EntradaInvalida);
    assert.throws(() => new Ejercicio({ ...ejSeleccion(), consigna: undefined }), EntradaInvalida);
  });

  it("rechaza opciones repetidas o respuesta inexistente", () => {
    const e = ejSeleccion();
    assert.throws(() => new Ejercicio({ ...e, opciones: [opcion("a"), opcion("a"), opcion("i")] }), EntradaInvalida);
    assert.throws(() => new Ejercicio({ ...e, respuestaCorrectaId: "z" }), EntradaInvalida);
  });

  it("exige que el orden sea una permutación de las piezas", () => {
    assert.throws(() => new Ejercicio({ ...ejOrden(), ordenCorrecto: ["p1"] }), EntradaInvalida);
    assert.throws(() => new Ejercicio({ ...ejOrden(), ordenCorrecto: ["p1", "p9"] }), EntradaInvalida);
    assert.throws(() => new Ejercicio({ ...ejOrden(), palabraId: undefined }), EntradaInvalida);
    const repetida = [{ id: "p1", texto: "ma" }, { id: "p2", texto: "ma" }];
    assert.ok(new Ejercicio({ ...ejOrden(), piezas: repetida }));
  });
});

describe("Entidad VersionJuego", () => {
  const v = { juegoId: "j1", configuracion: cfg("vocales", "seleccionar_opcion"), ejercicios: [ejSeleccion("e1"), ejSeleccion("e2")] };

  it("crea un borrador con ejercicios como instancias de Ejercicio", () => {
    const version = new VersionJuego(v);
    assert.equal(version.estado, "borrador");
    assert.ok(version.ejercicios.every((e) => e instanceof Ejercicio));
  });

  it("rechaza configuración incompatible, ids repetidos y exceso de ejercicios", () => {
    assert.throws(() => new VersionJuego({ ...v, configuracion: cfg("vocales", "ordenar_silabas") }), EntradaInvalida);
    assert.throws(() => new VersionJuego({ ...v, ejercicios: [ejSeleccion("e1"), ejSeleccion("e1")] }), EntradaInvalida);
    const seis = Array.from({ length: 6 }, (_, i) => ejSeleccion(`e${i}`));
    assert.throws(() => new VersionJuego({ ...v, ejercicios: seis }), EntradaInvalida);
    assert.throws(() => new VersionJuego({ ...v, configuracion: { ...v.configuracion, cantidadEjercicios: 7 } }), EntradaInvalida);
    assert.throws(() => new VersionJuego({ ...v, configuracion: undefined }), EntradaInvalida);
  });

  it("rechaza ejercicios que no corresponden a la mecánica o sin 3 opciones", () => {
    assert.throws(() => new VersionJuego({ ...v, ejercicios: [ejOrden()] }), EntradaInvalida);
    const dos = { ...ejSeleccion(), opciones: [opcion("a"), opcion("e")] };
    assert.throws(() => new VersionJuego({ ...v, ejercicios: [dos] }), EntradaInvalida);
  });

  it("una versión aprobada exige aprobadoEn y el número debe ser >= 1", () => {
    assert.throws(() => new VersionJuego({ ...v, estado: "aprobada" }), EntradaInvalida);
    assert.ok(new VersionJuego({ ...v, estado: "aprobada", aprobadoEn: new Date() }));
    assert.throws(() => new VersionJuego({ ...v, numero: 0 }), EntradaInvalida);
  });

  it("acepta ordenar_silabas", () => {
    const version = new VersionJuego({ juegoId: "j1", configuracion: cfg("palabras_silabas", "ordenar_silabas"), ejercicios: [ejOrden()] });
    assert.equal(version.ejercicios[0].tipo, "ordenar_silabas");
  });
});

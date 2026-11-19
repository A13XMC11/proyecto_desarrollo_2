const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

// Catálogo falso en memoria que implementa el puerto ICatalogoRecursos
const RECURSOS = [
  { id: "gato", palabra: "gato", tematica: "animales", silabas: ["ga", "to"], vocalInicial: "g" },
  { id: "oso", palabra: "oso", tematica: "animales", silabas: ["o", "so"], vocalInicial: "o" },
  { id: "araña", palabra: "araña", tematica: "animales", silabas: ["a", "ra", "ña"], vocalInicial: "a" },
  { id: "mama", palabra: "mamá", tematica: "animales", silabas: ["ma", "má"], vocalInicial: "m" },
  { id: "mesa", palabra: "mesa", tematica: "objetos_cotidianos", silabas: ["me", "sa"], vocalInicial: "m" },
  { id: "iguana", palabra: "iguana", tematica: "animales", silabas: ["i", "gua", "na"], vocalInicial: "i" },
  { id: "elefante", palabra: "elefante", tematica: "animales", silabas: ["e", "le", "fan", "te"], vocalInicial: "e" },
  { id: "uva", palabra: "uva", tematica: "naturaleza", silabas: ["u", "va"], vocalInicial: "u" }
];
const catalogo = { obtenerRecurso: (id) => RECURSOS.find((r) => r.id === id) };

const cfg = (habilidad, mecanica, cantidadEjercicios = 5, tematica = "animales") =>
  ({ habilidad, mecanica, tematica, cantidadEjercicios });

const opciones = (correcta, otras = ["e", "i"]) =>
  [correcta, ...otras].map((t) => ({ id: `op-${t}`, texto: t }));
const ejVocal = (id, recursoId, vocal, extra = {}) => ({
  id, consigna: `Mira la imagen ${id}`, pista: "Escucha el primer sonido", recursoId,
  opciones: opciones(vocal, ["a", "e", "i", "o", "u"].filter((v) => v !== vocal).slice(0, 2)),
  respuestaCorrectaId: `op-${vocal}`, ...extra
});
const ejSilabas = (id, palabraId, textos, orden, extra = {}) => ({
  id, consigna: "Ordena las sílabas", palabraId,
  piezas: textos.map((t, i) => ({ id: `p${i + 1}`, texto: t })),
  ordenCorrecto: orden ?? textos.map((_, i) => `p${i + 1}`), ...extra
});

const versionVocales = (ejercicios, cantidad = 5, tematica = "animales") =>
  new VersionJuego({ juegoId: "j1", configuracion: cfg("vocales", "seleccionar_opcion", cantidad, tematica), ejercicios });
const versionSilabas = (ejercicios) =>
  new VersionJuego({ juegoId: "j1", configuracion: cfg("palabras_silabas", "ordenar_silabas"), ejercicios });

const cincoVocales = () => [
  ejVocal("e1", "oso", "o"), ejVocal("e2", "araña", "a"), ejVocal("e3", "iguana", "i"),
  ejVocal("e4", "elefante", "e"), ejVocal("e5", "oso", "o", { consigna: "Otra mirada a la imagen" })
];
const cincoSilabas = () => [
  ejSilabas("e1", "gato", ["ga", "to"]), ejSilabas("e2", "oso", ["o", "so"]),
  ejSilabas("e3", "araña", ["a", "ra", "ña"]), ejSilabas("e4", "iguana", ["i", "gua", "na"]),
  ejSilabas("e5", "elefante", ["e", "le", "fan", "te"])
];

describe("VersionJuego.validarContenido", () => {
  it("acepta contenido coherente de ambas mecánicas", () => {
    assert.doesNotThrow(() => versionVocales(cincoVocales()).validarContenido(catalogo));
    assert.doesNotThrow(() => versionSilabas(cincoSilabas()).validarContenido(catalogo));
  });

  it("exige que la cantidad coincida con lo pedido", () => {
    assert.throws(() => versionVocales(cincoVocales().slice(0, 4)).validarContenido(catalogo), EntradaInvalida);
  });

  it("en un borrador incompleto (exigirCantidad: false) valida lo que hay, sin exigir la cantidad", () => {
    const incompleta = versionVocales(cincoVocales().slice(0, 2));
    assert.doesNotThrow(() => incompleta.validarContenido(catalogo, { exigirCantidad: false }));
    assert.doesNotThrow(() => versionVocales([]).validarContenido(catalogo, { exigirCantidad: false }));
    const mala = versionVocales([ejVocal("e1", "fantasma", "o")]);
    assert.throws(() => mala.validarContenido(catalogo, { exigirCantidad: false }), /no existe en el catálogo/);
  });

  it("10 ejercicios solo si está habilitado", () => {
    const diez = Array.from({ length: 10 }, (_, i) =>
      ejVocal(`e${i}`, "oso", "o", { consigna: `Mira la imagen número ${i}` }));
    const v = versionVocales(diez, 10);
    assert.throws(() => v.validarContenido(catalogo), EntradaInvalida);
    assert.doesNotThrow(() => v.validarContenido(catalogo, { permitirDiez: true }));
  });

  it("rechaza recursos inexistentes o de otra temática", () => {
    const inexistente = cincoVocales();
    inexistente[0] = ejVocal("e1", "dragon", "d");
    assert.throws(() => versionVocales(inexistente).validarContenido(catalogo), EntradaInvalida);

    const otraTematica = cincoVocales();
    otraTematica[0] = ejVocal("e1", "uva", "u");
    assert.throws(() => versionVocales(otraTematica).validarContenido(catalogo), EntradaInvalida);

    const opcionAjena = cincoVocales();
    opcionAjena[0] = { ...opcionAjena[0], opciones: opcionAjena[0].opciones.map((o, i) => (i === 1 ? { ...o, recursoId: "nada" } : o)) };
    assert.throws(() => versionVocales(opcionAjena).validarContenido(catalogo), EntradaInvalida);
  });

  it("rechaza ejercicios con la misma consigna y respuesta", () => {
    const repetidos = cincoVocales();
    repetidos[4] = ejVocal("e5", "oso", "o", { consigna: repetidos[0].consigna });
    assert.throws(() => versionVocales(repetidos).validarContenido(catalogo), /repetid/i);
  });

  it("rechaza opciones con texto duplicado", () => {
    const duplicadas = cincoVocales();
    duplicadas[0] = { ...duplicadas[0], opciones: [
      { id: "op-o", texto: "o" }, { id: "op-x", texto: "O" }, { id: "op-i", texto: "i" }
    ] };
    assert.throws(() => versionVocales(duplicadas).validarContenido(catalogo), /duplicad/i);
  });

  it("rechaza una respuesta que no es la vocal inicial del recurso (incoherente)", () => {
    const incoherente = cincoVocales();
    incoherente[0] = ejVocal("e1", "oso", "a");
    assert.throws(() => versionVocales(incoherente).validarContenido(catalogo), /vocal/i);
  });

  it("las sílabas deben reconstruir exactamente la palabra del catálogo", () => {
    const mal = cincoSilabas();
    mal[0] = ejSilabas("e1", "gato", ["ga", "te"]);
    assert.throws(() => versionSilabas(mal).validarContenido(catalogo), /sílabas/i);

    const desordenado = cincoSilabas();
    desordenado[0] = ejSilabas("e1", "gato", ["ga", "to"], ["p2", "p1"]);
    assert.throws(() => versionSilabas(desordenado).validarContenido(catalogo), /sílabas/i);
  });

  it("admite sílabas repetidas gracias a los ids de pieza", () => {
    const catalogoRepetida = { obtenerRecurso: (id) => (id === "gato"
      ? { id: "gato", palabra: "mama", tematica: "animales", silabas: ["ma", "ma"] } : catalogo.obtenerRecurso(id)) };
    const lista = cincoSilabas();
    lista[0] = ejSilabas("e1", "gato", ["ma", "ma"], ["p2", "p1"]);
    assert.doesNotThrow(() => versionSilabas(lista).validarContenido(catalogoRepetida));
  });

  it("la consigna o la pista no pueden contener la respuesta literal", () => {
    const pistaGato = cincoSilabas();
    pistaGato[0] = ejSilabas("e1", "gato", ["ga", "to"], undefined, { pista: "Es un Gato que maúlla" });
    assert.throws(() => versionSilabas(pistaGato).validarContenido(catalogo), /respuesta/i);

    const consignaOso = cincoVocales();
    consignaOso[0] = ejVocal("e1", "oso", "o", { consigna: "Empieza con la vocal o" });
    assert.throws(() => versionVocales(consignaOso).validarContenido(catalogo), /respuesta/i);
  });

  it("no confunde la respuesta con una palabra más larga que la contiene", () => {
    const lista = cincoSilabas();
    lista[1] = ejSilabas("e2", "oso", ["o", "so"], undefined, { pista: "Un animal poroso" });
    assert.doesNotThrow(() => versionSilabas(lista).validarContenido(catalogo));
  });

  it("no modifica la versión y devuelve la misma instancia", () => {
    const v = versionVocales(cincoVocales());
    const antes = JSON.stringify(v);
    assert.equal(v.validarContenido(catalogo), v);
    assert.equal(JSON.stringify(v), antes);
  });

  it("exige un catálogo válido", () => {
    assert.throws(() => versionVocales(cincoVocales()).validarContenido(undefined), EntradaInvalida);
  });
});

describe("VersionJuego.rechazarCamposDesconocidos", () => {
  it("rechaza campos fuera del contrato en ejercicios, opciones y piezas", () => {
    const base = cincoVocales();
    assert.doesNotThrow(() => VersionJuego.rechazarCamposDesconocidos(base));
    assert.throws(() => VersionJuego.rechazarCamposDesconocidos([{ ...base[0], extra: 1 }]), /desconocido/i);
    const opcionExtra = { ...base[0], opciones: base[0].opciones.map((o) => ({ ...o, rol: "x" })) };
    assert.throws(() => VersionJuego.rechazarCamposDesconocidos([opcionExtra]), /desconocido/i);
    const sil = ejSilabas("e1", "gato", ["ga", "to"]);
    sil.piezas[0].peso = 3;
    assert.throws(() => VersionJuego.rechazarCamposDesconocidos([sil]), /desconocido/i);
    assert.throws(() => VersionJuego.rechazarCamposDesconocidos("no"), EntradaInvalida);
  });
});

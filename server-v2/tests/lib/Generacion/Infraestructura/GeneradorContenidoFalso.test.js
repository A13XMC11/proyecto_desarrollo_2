const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const CatalogoRecursosJson = require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const ErrorDelGenerador = require("../../../../src/lib/Compartido/Dominio/Errores/ErrorDelGenerador");
const { TEMATICAS, COMPATIBILIDAD } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");

const catalogo = new CatalogoRecursosJson();
const generador = new GeneradorContenidoFalso();
const solicitud = (habilidad, tematica, cantidad = 5) =>
  ({ habilidad, mecanica: COMPATIBILIDAD[habilidad], tematica, cantidad, recursos: catalogo.listar({ tematica }) });

describe("GeneradorContenidoFalso", () => {
  for (const habilidad of ["vocales", "palabras_silabas", "completar_silaba", "contar_silabas"]) {
    for (const tematica of TEMATICAS) {
      it(`${habilidad} / ${tematica}: produce una actividad que pasa la validación pedagógica`, async () => {
        const { titulo, ejercicios, uso } = await generador.generar(solicitud(habilidad, tematica));
        assert.ok(titulo.length >= 3 && titulo.length <= 80);
        assert.equal(ejercicios.length, 5);
        assert.equal(uso.proveedor, "falso");
        const version = new VersionJuego({
          juegoId: "j1", ejercicios,
          configuracion: { habilidad, mecanica: COMPATIBILIDAD[habilidad], tematica, cantidadEjercicios: 5 }
        });
        assert.doesNotThrow(() => VersionJuego.rechazarCamposDesconocidos(ejercicios));
        assert.doesNotThrow(() => version.validarContenido(catalogo));
      });
    }
  }

  it("los ejercicios llevan el icono de su palabra", async () => {
    for (const habilidad of ["vocales", "palabras_silabas", "completar_silaba", "contar_silabas"]) {
      const { ejercicios } = await generador.generar(solicitud(habilidad, "animales"));
      assert.ok(ejercicios.every((e) => e.icono), habilidad);
    }
  });

  it("completar y contar funcionan también con 10 ejercicios", async () => {
    for (const habilidad of ["completar_silaba", "contar_silabas"]) {
      const { ejercicios } = await generador.generar(solicitud(habilidad, "escuela", 10));
      const version = new VersionJuego({
        juegoId: "j1", ejercicios,
        configuracion: { habilidad, mecanica: "seleccionar_opcion", tematica: "escuela", cantidadEjercicios: 10 }
      });
      assert.doesNotThrow(() => version.validarContenido(catalogo, { permitirDiez: true }), habilidad);
    }
  });

  it("completar: el hueco recorre las posiciones y la respuesta es la sílaba aprobada", async () => {
    const { ejercicios } = await generador.generar(solicitud("completar_silaba", "animales"));
    const huecos = ejercicios.map((e) => e.objetivo.split(" ").indexOf("__"));
    assert.ok(new Set(huecos).size > 1, "el hueco no siempre está en el mismo lugar");
    for (const e of ejercicios) {
      const correcta = e.opciones.find((o) => o.id === e.respuestaCorrectaId).texto;
      assert.equal(e.objetivo.replace("__", correcta).replaceAll(" ", ""), catalogo.obtenerRecurso(e.recursoId).palabra);
    }
  });

  it("completar: las opciones falsas nunca son sílabas que ya se ven en la palabra", async () => {
    for (const tematica of TEMATICAS) {
      const { ejercicios } = await generador.generar(solicitud("completar_silaba", tematica, 10));
      for (const e of ejercicios) {
        const visibles = e.objetivo.split(" ").filter((p) => p !== "__");
        const textos = e.opciones.map((o) => o.texto);
        assert.equal(textos.filter((t) => visibles.includes(t)).length, 0, `${e.objetivo} / ${textos}`);
        assert.equal(new Set(textos).size, 3);
      }
    }
  });

  it("es determinista: la misma solicitud da la misma actividad", async () => {
    const a = await generador.generar(solicitud("vocales", "animales"));
    const b = await generador.generar(solicitud("vocales", "animales"));
    assert.deepEqual(a, b);
  });

  it("si se piden más ejercicios que palabras distintas, repite con otra consigna (para 10, cuando se habilite)", async () => {
    const { ejercicios } = await generador.generar(solicitud("vocales", "animales", 10));
    const version = new VersionJuego({
      juegoId: "j1", ejercicios,
      configuracion: { habilidad: "vocales", mecanica: "seleccionar_opcion", tematica: "animales", cantidadEjercicios: 10 }
    });
    assert.doesNotThrow(() => version.validarContenido(catalogo, { permitirDiez: true }));
  });

  it("falla con ErrorDelGenerador si el catálogo no tiene palabras utilizables", async () => {
    await assert.rejects(generador.generar({ ...solicitud("vocales", "animales"), recursos: [] }), ErrorDelGenerador);
    await assert.rejects(generador.generar({ ...solicitud("palabras_silabas", "animales"), recursos: [] }), ErrorDelGenerador);
  });

  it("respeta una cancelación previa", async () => {
    const controlador = new AbortController();
    controlador.abort();
    await assert.rejects(generador.generar(solicitud("vocales", "animales"), { signal: controlador.signal }), ErrorDelGenerador);
  });
});

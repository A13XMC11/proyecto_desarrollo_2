const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const CatalogoRecursosJson = require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const { recursosParaGeneracion } = require("../../../../src/lib/Generacion/Dominio/Entidades/RecursosParaGeneracion");
const { periodoDiario, periodoMensual } = require("../../../../src/lib/Generacion/Dominio/Entidades/Periodo");
const { TEMATICAS, COMPATIBILIDAD } = require("../../../../src/lib/Compartido/Dominio/ValoresPermitidos");

const catalogo = new CatalogoRecursosJson();
const generador = new GeneradorContenidoFalso();

describe("GeneradorContenidoFalso", () => {
  for (const habilidad of Object.keys(COMPATIBILIDAD)) {
    for (const tematica of TEMATICAS) {
      it(`produce 5 ejercicios que pasan la validación pedagógica: ${habilidad} / ${tematica}`, async () => {
        const recursos = recursosParaGeneracion(catalogo, { habilidad, tematica });
        const { titulo, ejercicios, uso } = await generador.generar({ habilidad, tematica, cantidad: 5, recursos });
        assert.ok(titulo.length >= 3);
        assert.equal(uso.proveedor, "falso");
        VersionJuego.rechazarCamposDesconocidos(ejercicios);
        const version = new VersionJuego({
          juegoId: "candidato",
          configuracion: { habilidad, mecanica: COMPATIBILIDAD[habilidad], tematica, cantidadEjercicios: 5 },
          ejercicios
        });
        assert.doesNotThrow(() => version.validarContenido(catalogo, { exigirCantidad: true }));
      });
    }
  }

  it("las sílabas no aparecen ya ordenadas y la respuesta correcta varía de lugar", async () => {
    const recursos = recursosParaGeneracion(catalogo, { habilidad: "palabras_silabas", tematica: "animales" });
    const { ejercicios } = await generador.generar({ habilidad: "palabras_silabas", tematica: "animales", cantidad: 5, recursos });
    for (const e of ejercicios) assert.notDeepEqual(e.piezas.map((p) => p.id), e.ordenCorrecto);

    const vocales = recursosParaGeneracion(catalogo, { habilidad: "vocales", tematica: "animales" });
    const r = await generador.generar({ habilidad: "vocales", tematica: "animales", cantidad: 5, recursos: vocales });
    assert.ok(new Set(r.ejercicios.map((e) => e.respuestaCorrectaId)).size > 1);
  });

  it("falla con un código si el catálogo no alcanza", async () => {
    await assert.rejects(
      generador.generar({ habilidad: "vocales", tematica: "animales", cantidad: 5, recursos: [] }),
      (e) => e.codigo === "CATALOGO_INSUFICIENTE"
    );
  });
});

describe("Recursos y periodos de la generación", () => {
  it("vocales usa palabras que empiezan con vocal; sílabas, palabras de 2 a 3 sílabas", () => {
    assert.ok(recursosParaGeneracion(catalogo, { habilidad: "vocales", tematica: "animales" }).every((r) => r.vocalInicial));
    const silabas = recursosParaGeneracion(catalogo, { habilidad: "palabras_silabas", tematica: "animales" });
    assert.ok(silabas.every((r) => r.silabas.length <= 3));
    assert.ok(!silabas.some((r) => r.id === "elefante"));
  });

  it("el día del cupo es el de Ecuador, no el de UTC", () => {
    const nocheEnEcuador = new Date("2026-11-20T03:00:00Z"); // 22:00 del 19 en Guayaquil
    assert.equal(periodoDiario(nocheEnEcuador, "America/Guayaquil"), "2026-11-19");
    assert.equal(periodoMensual(new Date("2026-12-01T02:00:00Z"), "America/Guayaquil"), "2026-11");
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const config = (extra = {}) => ({ habilidad: "vocales", mecanica: "seleccionar_opcion", tematica: "animales", cantidadEjercicios: 5, ...extra });
const version = (configuracion) => new VersionJuego({ juegoId: "j1", configuracion });

describe("VersionJuego: modo de temática (paso 3)", () => {
  it("una versión sin modoTematica (guardada antes del cambio) se lee como del catálogo", () => {
    const v = version(config());
    assert.equal(v.configuracion.modoTematica, "catalogo");
    assert.equal(v.configuracion.tematica, "animales");
  });

  it("modoTematica explícito del catálogo exige una temática del enum", () => {
    assert.equal(version(config({ modoTematica: "catalogo" })).configuracion.modoTematica, "catalogo");
    assert.throws(() => version(config({ modoTematica: "catalogo", tematica: "frutas" })), EntradaInvalida);
    assert.throws(() => version(config({ tematica: "sonidos de animales" })), EntradaInvalida, "sin modo es catálogo: el texto libre no entra");
  });

  it("en modo libre la temática es texto de 3 a 40 letras y espacios, normalizado", () => {
    const v = version(config({ modoTematica: "libre", tematica: "  Frutas   TROPICALES " }));
    assert.equal(v.configuracion.modoTematica, "libre");
    assert.equal(v.configuracion.tematica, "frutas tropicales");
    for (const malo of ["ab", "a".repeat(41), "frutas1", "<i>x</i>", "", undefined]) {
      assert.throws(() => version(config({ modoTematica: "libre", tematica: malo })), EntradaInvalida, String(malo));
    }
  });

  it("el modo debe ser válido", () => {
    for (const malo of ["otro", "", null, 3]) {
      assert.throws(() => version(config({ modoTematica: malo })), EntradaInvalida, String(malo));
    }
  });

  it("el resto de la configuración sigue igual, y la configuración tiene los cinco campos", () => {
    const v = version(config());
    assert.deepEqual(Object.keys(v.configuracion).sort(), ["cantidadEjercicios", "habilidad", "mecanica", "modoTematica", "tematica"]);
    assert.equal(v.configuracion.cantidadEjercicios, 5);
  });
});

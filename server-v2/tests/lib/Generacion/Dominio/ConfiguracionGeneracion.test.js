const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const ConfiguracionGeneracion = require("../../../../src/lib/Generacion/Dominio/Entidades/ConfiguracionGeneracion");
const leer = require("../../../../src/lib/Generacion/Infraestructura/leerConfiguracionGeneracion");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const completa = {
  habilitada: true, tiempoLimiteMs: 30000, margenConciliacionMs: 5000,
  presupuestoMensual: 10, costoMaximoLlamada: 0.5, tarifaEntrada: 1, tarifaSalida: 4
};

describe("ConfiguracionGeneracion", () => {
  it("por defecto está apagada y con los límites iniciales del plan", () => {
    const c = new ConfiguracionGeneracion();
    assert.equal(c.habilitada, false);
    assert.equal(c.maxDiarias, 3);
    assert.equal(c.maxSimultaneas, 1);
    assert.equal(c.permitirDiez, false);
  });

  it("al habilitarla exige el tiempo límite y todos los valores económicos (no hay valores por defecto)", () => {
    assert.doesNotThrow(() => new ConfiguracionGeneracion(completa));
    for (const campo of ["tiempoLimiteMs", "margenConciliacionMs", "presupuestoMensual", "costoMaximoLlamada", "tarifaEntrada", "tarifaSalida"]) {
      assert.throws(() => new ConfiguracionGeneracion({ ...completa, [campo]: undefined }), EntradaInvalida, campo);
    }
  });

  it("rechaza valores absurdos", () => {
    assert.throws(() => new ConfiguracionGeneracion({ ...completa, presupuestoMensual: 0 }), EntradaInvalida);
    assert.throws(() => new ConfiguracionGeneracion({ ...completa, costoMaximoLlamada: -1 }), EntradaInvalida);
    assert.throws(() => new ConfiguracionGeneracion({ ...completa, costoMaximoLlamada: 11 }), /no puede superar/);
    assert.throws(() => new ConfiguracionGeneracion({ ...completa, tiempoLimiteMs: 1.5 }), EntradaInvalida);
    assert.throws(() => new ConfiguracionGeneracion({ maxDiarias: 0 }), EntradaInvalida);
    assert.throws(() => new ConfiguracionGeneracion({ maxSimultaneas: NaN }), EntradaInvalida);
    assert.throws(() => new ConfiguracionGeneracion({ habilitada: "si" }), EntradaInvalida);
  });

  it("calcula el costo real por millón de tokens, y no inventa uno si el uso es desconocido", () => {
    const c = new ConfiguracionGeneracion(completa);
    assert.equal(c.costoDe({ tokensEntrada: 2_000_000, tokensSalida: 500_000 }), 4);
    assert.equal(c.costoDe({ tokensEntrada: 0, tokensSalida: 0 }), 0);
    assert.equal(c.costoDe({ tokensEntrada: 10 }), undefined);
    assert.equal(c.costoDe({}), undefined);
    assert.equal(c.costoDe(), undefined);
    assert.equal(c.costoDe({ tokensEntrada: -1, tokensSalida: 5 }), undefined, "negativos: no creíble");
    assert.equal(c.costoDe({ tokensEntrada: 1.5, tokensSalida: 5 }), undefined, "no enteros: no creíble");
    assert.equal(c.costoDe({ tokensEntrada: NaN, tokensSalida: 5 }), undefined);
    assert.equal(c.vencimientoMs, 35000);
  });

  it("es inmutable", () => {
    const c = new ConfiguracionGeneracion(completa);
    assert.ok(Object.isFrozen(c));
    c.habilitada = false; // en modo no estricto la asignación se ignora en silencio
    assert.equal(c.habilitada, true);
  });
});

describe("leerConfiguracionGeneracion (entorno)", () => {
  it("sin variables: apagada y con los límites del plan", () => {
    const c = leer({});
    assert.equal(c.habilitada, false);
    assert.equal(c.maxDiarias, 3);
    assert.equal(c.permitirDiez, false);
  });

  it("AI_ENABLED=true sin los valores económicos no deja arrancar", () => {
    assert.throws(() => leer({ AI_ENABLED: "true" }), EntradaInvalida);
  });

  it("lee todos los valores", () => {
    const c = leer({
      AI_ENABLED: "true", PERMITIR_10_EJERCICIOS: "true", AI_MAX_DIARIAS: "5", AI_MAX_SIMULTANEAS: "2",
      AI_TIEMPO_LIMITE_MS: "20000", AI_MARGEN_CONCILIACION_MS: "1000", AI_PRESUPUESTO_MENSUAL: "8",
      AI_COSTO_MAXIMO_LLAMADA: "0.25", AI_TARIFA_ENTRADA_MTOK: "0.5", AI_TARIFA_SALIDA_MTOK: "2"
    });
    assert.deepEqual(
      [c.habilitada, c.permitirDiez, c.maxDiarias, c.maxSimultaneas, c.tiempoLimiteMs, c.presupuestoMensual, c.costoMaximoLlamada],
      [true, true, 5, 2, 20000, 8, 0.25]
    );
  });

  it("un valor que no es número se rechaza", () => {
    assert.throws(() => leer({ AI_MAX_DIARIAS: "tres" }), EntradaInvalida);
  });
});

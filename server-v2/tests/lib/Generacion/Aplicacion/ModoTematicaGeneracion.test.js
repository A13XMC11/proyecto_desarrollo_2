const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const { crearEscenario } = require("../../../Infraestructura/database/fixturesSql");
const { componer } = require("../../../../src/lib/Generacion/Infraestructura/http");
const ConfiguracionGeneracion = require("../../../../src/lib/Generacion/Dominio/Entidades/ConfiguracionGeneracion");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const FiltroContenidoJson = require("../../../../src/lib/Juego/Infraestructura/FiltroContenidoJson");
const { crearAsegurarCanales } = require("../../../../src/lib/Canal/Infraestructura/http");
const { periodoDiario } = require("../../../../src/lib/Generacion/Dominio/Entidades/Periodo");

// Caso de uso completo contra PostgreSQL y MongoDB reales; solo el generador es de prueba (sin proveedor ni costo)
const prueba = pruebasConBase("ModoTematicaGeneracion", { sql: true, mongo: true });
const falso = new GeneradorContenidoFalso();

const config = () => new ConfiguracionGeneracion({
  habilitada: true, tiempoLimiteMs: 5000, margenConciliacionMs: 0,
  presupuestoMensual: 1e6, costoMaximoLlamada: 1, tarifaEntrada: 1, tarifaSalida: 2
});
const montar = ({ filtroContenido } = {}) => {
  const llamadas = { n: 0 };
  const generar = async (s) => { llamadas.n += 1; return { ...(await falso.generar(s)), uso: { proveedor: "prueba", modelo: "m", tokensEntrada: 1000, tokensSalida: 1000 } }; };
  return { c: componer({ config: config(), generador: { generar }, filtroContenido }), llamadas };
};

let contador = 0;
const clave = () => `clave-modo-${String(++contador).padStart(8, "0")}`;
const datosDe = (esc, extra = {}) => ({ cursoId: esc.cursoId, estudianteId: esc.estudianteId, habilidad: "vocales", tematica: "animales", cantidad: 5, ...extra });
const escenario = async () => {
  await crearAsegurarCanales().ejecutar();
  return crearEscenario();
};
const usado = async (c, docenteId) => {
  const cuota = await c.cuotaRepo.obtener(docenteId, periodoDiario(new Date(), config().zonaHoraria));
  return cuota ? cuota.reservado + cuota.consumido : 0;
};

describe("SolicitarGeneracion: modo de temática (paso 3)", () => {
  prueba("(a) en modo catálogo, con o sin modoTematica, genera y guarda lo mismo que antes", async () => {
    const esc = await escenario();
    const { c } = montar();
    for (const extra of [{}, { modoTematica: "catalogo" }]) {
      const { generacion, esNueva } = await c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc, extra));
      assert.equal(esNueva, true);
      assert.equal(generacion.estado, "completada");
      assert.deepEqual([generacion.parametros.modoTematica, generacion.parametros.tematica], ["catalogo", "animales"]);
      const version = (await c.versionRepo.findByJuego(generacion.juegoId))[0];
      assert.deepEqual([version.configuracion.modoTematica, version.configuracion.tematica], ["catalogo", "animales"]);
      assert.equal(version.ejercicios.length, 5);
    }
  });

  prueba("(d) dos solicitudes idénticas salvo modoTematica no son la misma para la idempotencia", async () => {
    const esc = await escenario();
    const { c, llamadas } = montar({ filtroContenido: new FiltroContenidoJson() });
    const k = clave();
    const primera = await c.solicitar.ejecutar(esc.docenteId, k, datosDe(esc));
    assert.equal(primera.generacion.estado, "completada");

    // Mismo docente, misma clave y mismos datos; solo cambia el modo
    await assert.rejects(
      c.solicitar.ejecutar(esc.docenteId, k, datosDe(esc, { modoTematica: "libre" })),
      (e) => e.codigo === "CLAVE_REUTILIZADA"
    );
    assert.equal(llamadas.n, 1, "no se llamó otra vez al generador");
    assert.equal(await usado(c, esc.docenteId), 1, "no se gastó más cupo");
    // La misma solicitud exacta, en cambio, sigue devolviendo la original
    const repetida = await c.solicitar.ejecutar(esc.docenteId, k, datosDe(esc));
    assert.equal(repetida.esNueva, false);
    assert.equal(repetida.generacion.id, primera.generacion.id);
    // Y el modo explícito del catálogo es la misma solicitud que sin modo
    const explicita = await c.solicitar.ejecutar(esc.docenteId, k, datosDe(esc, { modoTematica: "catalogo" }));
    assert.equal(explicita.esNueva, false);
    assert.equal(explicita.generacion.id, primera.generacion.id);
  });

  prueba("la temática libre sin filtro configurado se rechaza antes de guardar o reservar nada", async () => {
    const esc = await escenario();
    const { c, llamadas } = montar();
    await assert.rejects(
      c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc, { modoTematica: "libre", tematica: "sonidos de animales" })),
      (e) => e.statusCode === 400 && e.codigo === "TEMATICA_LIBRE_NO_DISPONIBLE"
    );
    assert.deepEqual(await c.repo.findByDocente(esc.docenteId), []);
    assert.equal(await usado(c, esc.docenteId), 0);
    assert.equal(llamadas.n, 0);
  });

  prueba("una temática libre bloqueada por el filtro se rechaza antes de guardar o reservar, sin repetir el término", async () => {
    const esc = await escenario();
    const { c, llamadas } = montar({ filtroContenido: new FiltroContenidoJson() });
    await assert.rejects(
      c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc, { modoTematica: "libre", tematica: "pistolas y armas" })),
      (e) => e.statusCode === 400 && e.codigo === "TEMATICA_NO_PERMITIDA" && !/pistola|arma/i.test(e.message)
    );
    assert.deepEqual(await c.repo.findByDocente(esc.docenteId), []);
    assert.equal(await usado(c, esc.docenteId), 0);
    assert.equal(llamadas.n, 0);
  });

  prueba("un modo desconocido o una temática libre mal escrita se rechazan antes de guardar nada", async () => {
    const esc = await escenario();
    const { c } = montar({ filtroContenido: new FiltroContenidoJson() });
    for (const extra of [{ modoTematica: "otro" }, { modoTematica: "libre", tematica: "frutas123" }, { modoTematica: "libre", tematica: "ab" }, { modoTematica: "libre", tematica: undefined }]) {
      await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), datosDe(esc, extra)), (e) => e.statusCode === 400, JSON.stringify(extra));
    }
    assert.deepEqual(await c.repo.findByDocente(esc.docenteId), []);
    assert.equal(await usado(c, esc.docenteId), 0);
  });
});

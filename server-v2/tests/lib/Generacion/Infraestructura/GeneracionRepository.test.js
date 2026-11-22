const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID: uuid, randomBytes } = require("node:crypto");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const { crearEscenario } = require("../../../Infraestructura/database/fixturesSql");
const Generacion = require("../../../../src/lib/Generacion/Dominio/Entidades/Generacion");
const ConflictoDeEstado = require("../../../../src/lib/Compartido/Dominio/Errores/ConflictoDeEstado");
const Repo = require("../../../../src/lib/Generacion/Infraestructura/GeneracionRepositorySequelize");
const CuotaRepo = require("../../../../src/lib/Generacion/Infraestructura/CuotaRepositorySequelize");
const GeneracionModel = require("../../../../src/lib/Generacion/Infraestructura/GeneracionModel");
const { obtenerSequelize } = require("../../../../src/Infraestructura/database/Sequelize");

// canalId y juegoId son ObjectId de documentos Mongo
const oid = () => randomBytes(12).toString("hex");
const prueba = pruebasConBase("GeneracionRepository", { sql: true, mongo: false });
const repo = new Repo();
const cuotas = new CuotaRepo();
let contador = 0;
const gen = ({ docenteId, cursoId, estudianteId }, clave = `clave-solicitud-${String(++contador).padStart(6, "0")}`) =>
  new Generacion({
    docenteId, canalId: oid(), claveSolicitud: clave,
    parametros: {
      cursoId, estudianteId, habilidad: "vocales", tematica: "animales", cantidad: 5, instruccion: "Animales de la granja"
    }
  });

describe("GeneracionRepositorySequelize", () => {
  prueba("guarda, lee y aísla por docente; la mecánica se deduce de la habilidad", async () => {
    const esc = await crearEscenario();
    const d = esc.docenteId;
    const { generacion, esNueva } = await repo.save(gen(esc));
    assert.equal(esNueva, true);
    assert.ok(generacion instanceof Generacion);
    assert.equal(generacion.estado, "pendiente");
    assert.equal(generacion.reserva, undefined);
    assert.equal(generacion.mecanica, "seleccionar_opcion");
    assert.equal(generacion.parametros.estudianteId, esc.estudianteId);
    assert.ok(generacion.creadaEn instanceof Date);
    assert.equal((await repo.findById(generacion.id, d)).parametros.instruccion, "Animales de la granja");
    assert.equal(await repo.findById(generacion.id, uuid()), null);
    assert.equal(await repo.findById("no-es-id", d), null);
    assert.equal((await repo.findByClave(d, generacion.claveSolicitud)).id, generacion.id);
    assert.equal(await repo.findByClave(uuid(), generacion.claveSolicitud), null);
    assert.equal(await repo.findByClave(d, { $ne: null }), null);
  });

  prueba("las referencias deben existir (claves foráneas)", async () => {
    const esc = await crearEscenario();
    const huerfana = (extra) => repo.save(gen({ ...esc, ...extra }));
    const esFk = (e) => e.name === "SequelizeForeignKeyConstraintError";
    await assert.rejects(huerfana({ docenteId: uuid() }), esFk);
    await assert.rejects(huerfana({ cursoId: uuid() }), esFk);
    await assert.rejects(huerfana({ estudianteId: uuid() }), esFk);
    assert.ok((await huerfana({ estudianteId: undefined })).esNueva, "el estudiante es opcional");
  });

  prueba("claveSolicitud repetida devuelve la existente (no nueva)", async () => {
    const esc = await crearEscenario();
    const a = await repo.save(gen(esc, "clave-repetida-0001"));
    const b = await repo.save(gen(esc, "clave-repetida-0001"));
    assert.equal(b.esNueva, false);
    assert.equal(b.generacion.id, a.generacion.id);
    const otro = await repo.save(gen(await crearEscenario(), "clave-repetida-0001"));
    assert.equal(otro.esNueva, true, "otro docente puede usar la misma clave");
  });

  prueba("claveSolicitud repetida en paralelo devuelve la misma generación", async () => {
    const esc = await crearEscenario();
    const r = await Promise.all(Array.from({ length: 10 }, () => repo.save(gen(esc, "clave-paralela-0001"))));
    assert.equal(r.filter((x) => x.esNueva).length, 1);
    assert.equal(new Set(r.map((x) => x.generacion.id)).size, 1);
    assert.equal(await GeneracionModel.count({ where: { docenteId: esc.docenteId } }), 1);
  });

  prueba("transiciones condicionales: no pisan estados finales", async () => {
    const esc = await crearEscenario();
    const d = esc.docenteId;
    const { generacion: g } = await repo.save(gen(esc));
    assert.equal(await repo.contarActivas(d), 1);
    assert.equal((await repo.marcarProcesando(g.id, d)).estado, "procesando");
    assert.equal(await repo.marcarProcesando(g.id, d), null);
    assert.equal(await repo.marcarProcesando(g.id, uuid()), null);

    const juegoId = oid();
    const completada = await repo.marcarCompletada(g.id, d, juegoId, {
      proveedor: "p", modelo: "m", tokensEntrada: 100, tokensSalida: 50, estado: "fallida", docenteId: uuid()
    });
    assert.equal(completada.estado, "completada");
    assert.equal(completada.juegoId, juegoId);
    assert.equal(completada.tokensEntrada, 100);
    assert.equal(completada.docenteId, d);
    assert.ok(completada.finalizadaEn);
    assert.equal(await repo.marcarCompletada(g.id, d, "no-es-objectid"), null);
    assert.equal(await repo.marcarFallida(g.id, d, "X"), null);
    assert.equal(await repo.marcarInterrumpida(g.id, d), null);
    assert.equal((await repo.findById(g.id, d)).estado, "completada");
    assert.equal(await repo.contarActivas(d), 0);
  });

  prueba("findActivas lista las activas del docente, de la más antigua a la más reciente", async () => {
    const esc = await crearEscenario();
    const otro = await crearEscenario();
    const a = (await repo.save(gen(esc))).generacion;
    const b = (await repo.save(gen(esc))).generacion;
    const c = (await repo.save(gen(esc))).generacion;
    await repo.save(gen(otro));
    await repo.marcarProcesando(b.id, esc.docenteId);
    await repo.marcarFallida(c.id, esc.docenteId, "X");

    assert.deepEqual((await repo.findActivas(esc.docenteId)).map((g) => g.id), [a.id, b.id], "sin las cerradas ni las de otro docente");
    assert.deepEqual(await repo.findActivas(uuid()), []);
    assert.deepEqual(await repo.findActivas("no-es-id"), []);
  });

  prueba("las transiciones 'si pendiente' solo ganan desde pendiente, y reabrirReserva deshace la compuerta", async () => {
    const esc = await crearEscenario();
    const d = esc.docenteId;
    const a = (await repo.save(gen(esc))).generacion;
    const b = (await repo.save(gen(esc))).generacion;
    await repo.marcarProcesando(b.id, d);

    assert.equal((await repo.marcarFallidaSiPendiente(a.id, d, "CANCELADA_POR_DOCENTE")).estado, "fallida");
    assert.equal(await repo.marcarFallidaSiPendiente(a.id, d, "X"), null, "ya no está pendiente");
    assert.equal(await repo.marcarFallidaSiPendiente(b.id, d, "X"), null, "procesando: no gana");
    assert.equal(await repo.marcarInterrumpidaSiPendiente(b.id, d), null);
    assert.equal((await repo.findById(b.id, d)).estado, "procesando", "no se tocó");

    const c = (await repo.save(gen(esc))).generacion;
    const interrumpida = await repo.marcarInterrumpidaSiPendiente(c.id, d, { usoDesconocido: false });
    assert.deepEqual([interrumpida.estado, interrumpida.usoDesconocido], ["interrumpida", false]);

    const diaria = await cuotas.reservar({ docenteId: d, periodo: "2026-01-01", cantidad: 1, limite: 5 });
    const global = await cuotas.reservar({ periodo: "2026-01", cantidad: 1, limite: 1e6 });
    await repo.registrarReserva(b.id, d, { cuotaDiariaId: diaria.cuota.id, cupoDiario: 1, cuotaGlobalId: global.cuota.id, montoGlobal: 1 });
    assert.ok(await repo.marcarReservaLiberada(b.id, d));
    assert.equal((await repo.findById(b.id, d)).reserva.liberada, true);
    assert.equal((await repo.reabrirReserva(b.id, d)).reserva.liberada, false);
    assert.equal(await repo.reabrirReserva(b.id, uuid()), null);
  });

  prueba("findVencidas filtra por docente en la consulta: un lote lleno de otros no lo deja fuera", async () => {
    const mio = await crearEscenario();
    const otro = await crearEscenario();
    await repo.save(gen(otro));
    await repo.save(gen(otro));
    const m = (await repo.save(gen(mio))).generacion;
    const futuro = new Date(Date.now() + 3600_000);

    assert.equal((await repo.findVencidas(futuro, { limite: 1 })).length, 1);
    const propias = await repo.findVencidas(futuro, { docenteId: mio.docenteId, limite: 1 });
    assert.deepEqual(propias.map((g) => g.id), [m.id]);
    assert.deepEqual(await repo.findVencidas(futuro, { docenteId: "no-es-id" }), []);
    assert.deepEqual(await repo.findVencidas(new Date(0), { docenteId: mio.docenteId }), [], "no vencida");
  });

  prueba("un juego pertenece a una sola generación", async () => {
    const esc = await crearEscenario();
    const a = (await repo.save(gen(esc))).generacion;
    const b = (await repo.save(gen(esc))).generacion;
    const juegoId = oid();
    await repo.marcarCompletada(a.id, esc.docenteId, juegoId);
    await assert.rejects(
      repo.marcarCompletada(b.id, esc.docenteId, juegoId),
      (e) => e instanceof ConflictoDeEstado && e.codigo === "JUEGO_YA_ASOCIADO"
    );
  });

  prueba("fallida e interrumpida registran error y uso desconocido", async () => {
    const esc = await crearEscenario();
    const d = esc.docenteId;
    const { generacion: a } = await repo.save(gen(esc));
    const fallida = await repo.marcarFallida(a.id, d, "CONTENIDO_INVALIDO", { tokensEntrada: 10, tokensSalida: 5 });
    assert.equal(fallida.estado, "fallida");
    assert.equal(fallida.errorCodigo, "CONTENIDO_INVALIDO");
    const { generacion: b } = await repo.save(gen(esc));
    const interrumpida = await repo.marcarInterrumpida(b.id, d);
    assert.equal(interrumpida.estado, "interrumpida");
    assert.equal(interrumpida.usoDesconocido, true);
    const tarde = await repo.marcarCompletada(b.id, d, oid());
    assert.equal(tarde.estado, "completada", "la conciliación puede completar una interrumpida");
    assert.equal(tarde.errorCodigo, undefined);
  });

  prueba("la reserva apunta a los dos contadores y se libera una sola vez (en paralelo)", async () => {
    const esc = await crearEscenario();
    const d = esc.docenteId;
    const { generacion: g } = await repo.save(gen(esc));
    assert.equal(await repo.marcarReservaLiberada(g.id, d), null, "sin reserva no hay nada que liberar");
    const diaria = (await cuotas.reservar({ docenteId: d, periodo: "2026-10-21", cantidad: 1, limite: 5 })).cuota;
    const global = (await cuotas.reservar({ periodo: "2026-10", cantidad: 5, limite: 100 })).cuota;
    const conReserva = await repo.registrarReserva(g.id, d, {
      cuotaDiariaId: diaria.id, cupoDiario: 1, cuotaGlobalId: global.id, montoGlobal: 5
    });
    assert.equal(conReserva.reserva.liberada, false);
    assert.equal(conReserva.reserva.montoGlobal, 5);
    assert.equal(conReserva.reserva.cuotaDiariaId, diaria.id);
    const r = await Promise.all(Array.from({ length: 6 }, () => repo.marcarReservaLiberada(g.id, d)));
    assert.equal(r.filter(Boolean).length, 1);
    assert.equal((await repo.findById(g.id, d)).reserva.liberada, true);
    assert.equal(await repo.marcarReservaLiberada(g.id, uuid()), null);
  });

  prueba("no registra reserva en una generación ya cerrada", async () => {
    const esc = await crearEscenario();
    const d = esc.docenteId;
    const { generacion: g } = await repo.save(gen(esc));
    await repo.marcarFallida(g.id, d, "X");
    const c = (await cuotas.reservar({ docenteId: d, periodo: "2026-10-25", cantidad: 1, limite: 5 })).cuota;
    assert.equal(await repo.registrarReserva(g.id, d, { cuotaDiariaId: c.id, cupoDiario: 1, cuotaGlobalId: c.id, montoGlobal: 1 }), null);
  });

  prueba("findVencidas devuelve solo activas antiguas", async () => {
    const esc = await crearEscenario();
    const d = esc.docenteId;
    const { generacion: vieja } = await repo.save(gen(esc));
    const { generacion: finalizada } = await repo.save(gen(esc));
    await repo.marcarFallida(finalizada.id, d, "X");
    await obtenerSequelize().query(
      "UPDATE generaciones_ia SET creada_en = now() - interval '1 hour' WHERE id IN (:ids)",
      { replacements: { ids: [vieja.id, finalizada.id] } }
    );
    const { generacion: reciente } = await repo.save(gen(esc));
    const ids = (await repo.findVencidas(new Date(Date.now() - 60000))).map((g) => g.id);
    assert.ok(ids.includes(vieja.id));
    assert.ok(!ids.includes(finalizada.id));
    assert.ok(!ids.includes(reciente.id));
    assert.deepEqual(await repo.findVencidas("no-es-fecha"), []);
  });
});

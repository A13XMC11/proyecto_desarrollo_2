const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const { crearDocente } = require("../../../Infraestructura/database/fixturesSql");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");
const Cuota = require("../../../../src/lib/Generacion/Dominio/Entidades/Cuota");
const Repo = require("../../../../src/lib/Generacion/Infraestructura/CuotaRepositorySequelize");

const prueba = pruebasConBase("CuotaRepository", { sql: true, mongo: false });
const repo = new Repo();
const DIA = "2026-10-21";

describe("CuotaRepositorySequelize", () => {
  prueba("obtener devuelve null si no existe; reservar crea el contador del docente", async () => {
    const { id: docenteId } = await crearDocente();
    assert.equal(await repo.obtener(docenteId, DIA), null);
    const { reservada, cuota } = await repo.reservar({ docenteId, periodo: DIA, cantidad: 1, limite: 3 });
    assert.equal(reservada, true);
    assert.ok(cuota instanceof Cuota);
    assert.equal(cuota.reservado, 1);
    assert.equal(cuota.docenteId, docenteId);
    assert.equal((await repo.obtener(docenteId, DIA)).consumido, 0);
  });

  prueba("el contador global (sin docente) es único por periodo y distinto del de los docentes", async () => {
    const { id: docenteId } = await crearDocente();
    const global = await repo.reservar({ periodo: "2026-12", cantidad: 5, limite: 100 });
    assert.equal(global.cuota.esGlobal(), true);
    const otra = await repo.reservar({ periodo: "2026-12", cantidad: 5, limite: 100 });
    assert.equal(otra.cuota.id, global.cuota.id, "reutiliza el mismo contador global");
    assert.equal(otra.cuota.reservado, 10);
    const deDocente = await repo.reservar({ docenteId, periodo: "2026-12", cantidad: 1, limite: 3 });
    assert.notEqual(deDocente.cuota.id, global.cuota.id);
    assert.equal((await repo.obtener(undefined, "2026-12")).reservado, 10);
  });

  prueba("un contador exige un docente existente (clave foránea)", async () => {
    await assert.rejects(
      repo.reservar({ docenteId: "123e4567-e89b-42d3-a456-426614174000", periodo: DIA, cantidad: 1, limite: 3 }),
      (e) => e.name === "SequelizeForeignKeyConstraintError"
    );
  });

  prueba("nunca supera el límite en secuencia", async () => {
    const { id: docenteId } = await crearDocente();
    const pedir = () => repo.reservar({ docenteId, periodo: DIA, cantidad: 1, limite: 3 });
    const r = [await pedir(), await pedir(), await pedir(), await pedir()];
    assert.deepEqual(r.map((x) => x.reservada), [true, true, true, false]);
    assert.equal(r[3].cuota.reservado, 3);
  });

  prueba("reservas concurrentes no superan el límite (30 peticiones, límite 5)", async () => {
    const { id: docenteId } = await crearDocente();
    const r = await Promise.all(
      Array.from({ length: 30 }, () => repo.reservar({ docenteId, periodo: DIA, cantidad: 1, limite: 5 }))
    );
    assert.equal(r.filter((x) => x.reservada).length, 5);
    const cuota = await repo.obtener(docenteId, DIA);
    assert.equal(cuota.reservado, 5);
    assert.equal(cuota.consumido, 0);
  });

  prueba("reservas concurrentes con montos distintos respetan el presupuesto global", async () => {
    const r = await Promise.all(
      Array.from({ length: 20 }, () => repo.reservar({ periodo: "2026-11", cantidad: 30, limite: 100 }))
    );
    assert.equal(r.filter((x) => x.reservada).length, 3);
    assert.equal((await repo.obtener(undefined, "2026-11")).reservado, 90);
  });

  prueba("el consumido también cuenta contra el límite", async () => {
    const { id: docenteId } = await crearDocente();
    const p = "2026-10-22";
    const { cuota } = await repo.reservar({ docenteId, periodo: p, cantidad: 2, limite: 3 });
    const c = await repo.consumir({ cuotaId: cuota.id, cantidad: 2 });
    assert.equal(c.consumida, true);
    assert.deepEqual([c.cuota.reservado, c.cuota.consumido], [0, 2]);
    assert.equal((await repo.reservar({ docenteId, periodo: p, cantidad: 2, limite: 3 })).reservada, false);
    assert.equal((await repo.reservar({ docenteId, periodo: p, cantidad: 1, limite: 3 })).reservada, true);
  });

  prueba("liberar y consumir son condicionales y nunca dejan reservado negativo", async () => {
    const { id: docenteId } = await crearDocente();
    const p = "2026-10-23";
    const { cuota } = await repo.reservar({ docenteId, periodo: p, cantidad: 2, limite: 5 });
    assert.equal((await repo.liberar({ cuotaId: cuota.id, cantidad: 3 })).liberada, false);
    assert.equal((await repo.consumir({ cuotaId: cuota.id, cantidad: 3 })).consumida, false);
    assert.equal((await repo.liberar({ cuotaId: cuota.id, cantidad: 2 })).cuota.reservado, 0);
    assert.equal((await repo.liberar({ cuotaId: cuota.id, cantidad: 1 })).liberada, false);
    assert.equal((await repo.liberar({ cuotaId: "no-es-id", cantidad: 1 })).cuota, null);

    await repo.reservar({ docenteId, periodo: p, cantidad: 2, limite: 5 });
    const real = await repo.consumir({ cuotaId: cuota.id, cantidad: 2, real: 1 });
    assert.deepEqual([real.cuota.reservado, real.cuota.consumido], [0, 1], "el consumo real puede diferir de lo reservado");
  });

  prueba("liberaciones concurrentes de una misma reserva: solo una surte efecto", async () => {
    const { id: docenteId } = await crearDocente();
    const { cuota } = await repo.reservar({ docenteId, periodo: "2026-10-24", cantidad: 1, limite: 5 });
    const r = await Promise.all(Array.from({ length: 10 }, () => repo.liberar({ cuotaId: cuota.id, cantidad: 1 })));
    assert.equal(r.filter((x) => x.liberada).length, 1);
    assert.equal((await repo.obtener(docenteId, "2026-10-24")).reservado, 0);
  });

  prueba("valida la entrada", async () => {
    const { id: docenteId } = await crearDocente();
    await assert.rejects(repo.reservar({ docenteId, periodo: DIA, cantidad: 0, limite: 3 }), EntradaInvalida);
    await assert.rejects(repo.reservar({ docenteId, periodo: DIA, cantidad: 1, limite: -1 }), EntradaInvalida);
    await assert.rejects(repo.reservar({ docenteId, periodo: "x", cantidad: 1, limite: 3 }), EntradaInvalida);
    await assert.rejects(repo.reservar({ docenteId: "no-es-uuid", periodo: DIA, cantidad: 1, limite: 3 }), EntradaInvalida);
    await assert.rejects(repo.reservar({ docenteId, periodo: DIA, cantidad: "1; DROP TABLE x", limite: 3 }), EntradaInvalida);
    assert.equal((await repo.reservar({ docenteId, periodo: DIA, cantidad: 1, limite: 0 })).reservada, false, "límite cero = deshabilitado");
  });
});

const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const uuid = () => randomUUID();
const ConflictoDeEstado = require("../../../../src/lib/Compartido/Dominio/Errores/ConflictoDeEstado");
const Docente = require("../../../../src/lib/Docente/Dominio/Entidades/Docente");
const Repo = require("../../../../src/lib/Docente/Infraestructura/DocenteRepositorySequelize");

const prueba = pruebasConBase("DocenteRepository", { sql: true, mongo: false });
const repo = new Repo();
const nuevo = (correo = `d${uuid()}@x.ec`) => new Docente({ nombre: "Ana", correo, hash: "hash-secreto", institucion: "Escuela" });

describe("DocenteRepositorySequelize", () => {
  prueba("guarda y lee devolviendo entidades sin hash", async () => {
    const guardado = await repo.save(nuevo("A@x.ec"));
    assert.ok(guardado instanceof Docente);
    assert.equal(guardado.hash, undefined);
    assert.equal(guardado.correo, "a@x.ec");
    const leido = await repo.findById(guardado.id);
    assert.equal(leido.hash, undefined);
    assert.equal(leido.nombre, "Ana");
    assert.equal(await repo.findById(uuid()), null);
    assert.equal(await repo.findById("no-es-id"), null);
  });

  prueba("findByCorreo normaliza y devuelve el hash", async () => {
    await repo.save(nuevo("login@x.ec"));
    const d = await repo.findByCorreo("  LOGIN@x.ec ");
    assert.equal(d.hash, "hash-secreto");
    assert.equal(await repo.findByCorreo("otro@x.ec"), null);
    assert.equal(await repo.findByCorreo({ $ne: null }), null);
  });

  prueba("correo duplicado -> ConflictoDeEstado", async () => {
    await repo.save(nuevo("dup@x.ec"));
    await assert.rejects(repo.save(nuevo("DUP@x.ec")), (e) => e instanceof ConflictoDeEstado && e.codigo === "CORREO_YA_REGISTRADO");
  });

  prueba("registros simultáneos con el mismo correo: solo uno se guarda", async () => {
    const resultados = await Promise.allSettled(Array.from({ length: 6 }, () => repo.save(nuevo("carrera@x.ec"))));
    assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
    assert.ok(resultados.filter((r) => r.status === "rejected").every((r) => r.reason instanceof ConflictoDeEstado));
  });

  prueba("update solo cambia nombre e institucion", async () => {
    const d = await repo.save(nuevo());
    const actualizado = await repo.update(d.id, { nombre: "Nuevo Nombre", institucion: null, correo: "hack@x.ec", hash: "x" });
    assert.equal(actualizado.nombre, "Nuevo Nombre");
    assert.equal(actualizado.institucion, undefined);
    assert.equal(actualizado.correo, d.correo);
    assert.equal((await repo.findByCorreo(d.correo)).hash, "hash-secreto");
    assert.equal(await repo.update(uuid(), { nombre: "Zz" }), null);
    await assert.rejects(repo.update(d.id, { nombre: "A" }), (e) => e.name === "SequelizeValidationError");
  });
});

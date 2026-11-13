const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const IniciarSesion = require("../../../../src/lib/Docente/Aplicacion/IniciarSesion");
const Docente = require("../../../../src/lib/Docente/Dominio/Entidades/Docente");
const HasheadorContrasenaScrypt = require("../../../../src/lib/Docente/Infraestructura/HasheadorContrasenaScrypt");

const hasheador = new HasheadorContrasenaScrypt();

async function caso() {
  const hash = await hasheador.hashear("clave-segura");
  const docente = new Docente({
    id: "11111111-1111-4111-8111-111111111111", nombre: "Ana", correo: "ana@escuela.ec", hash
  });
  const repo = { findByCorreo: async (c) => (c.trim().toLowerCase() === docente.correo ? docente : null) };
  return new IniciarSesion(repo, hasheador);
}

describe("IniciarSesion", () => {
  it("con credenciales correctas devuelve la vista pública (sin hash)", async () => {
    const r = await (await caso()).ejecutar({ correo: " ANA@escuela.ec ", contrasena: "clave-segura" });
    assert.equal(r.nombre, "Ana");
    assert.equal(r.hash, undefined);
  });

  it("contraseña errónea y correo inexistente dan el mismo 401", async () => {
    const uc = await caso();
    for (const datos of [
      { correo: "ana@escuela.ec", contrasena: "otra-clave" },
      { correo: "nadie@escuela.ec", contrasena: "clave-segura" }
    ]) {
      await assert.rejects(uc.ejecutar(datos), (e) => e.statusCode === 401 && e.codigo === "CREDENCIALES_INVALIDAS");
    }
  });

  it("sin datos -> 400", async () => {
    await assert.rejects((await caso()).ejecutar({}), (e) => e.statusCode === 400);
  });
});

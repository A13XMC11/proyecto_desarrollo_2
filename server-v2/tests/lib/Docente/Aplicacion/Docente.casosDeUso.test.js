const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const RegistrarDocente = require("../../../../src/lib/Docente/Aplicacion/RegistrarDocente");
const ObtenerDocentePorId = require("../../../../src/lib/Docente/Aplicacion/ObtenerDocentePorId");
const HasheadorContrasenaScrypt = require("../../../../src/lib/Docente/Infraestructura/HasheadorContrasenaScrypt");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");
const NoEncontrado = require("../../../../src/lib/Compartido/Dominio/Errores/NoEncontrado");

// Repositorio y hasheador falsos en memoria: implementan los mismos Ports, sin base de datos
class DocenteRepositoryFalso {
  constructor() { this.guardados = []; }
  async save(docente) {
    const guardado = Object.assign(Object.create(Object.getPrototypeOf(docente)), docente, { id: String(this.guardados.length + 1) });
    this.guardados.push(guardado);
    return guardado;
  }
  async findById(id) { return this.guardados.find((d) => d.id === id) || null; }
}
const hasheadorFalso = { hashear: async (c) => `hash(${c})`, verificar: async (c, h) => h === `hash(${c})` };
const datos = { nombre: "Ana Pérez", correo: "ANA@escuela.ec", contrasena: "clave12345", institucion: "Escuela" };

describe("Caso de uso RegistrarDocente", () => {
  it("guarda el hash, nunca la contraseña, y devuelve la vista pública", async () => {
    const repo = new DocenteRepositoryFalso();
    const publico = await new RegistrarDocente(repo, hasheadorFalso).ejecutar(datos);
    assert.deepEqual(Object.keys(publico).sort(), ["correo", "id", "institucion", "nombre"]);
    assert.equal(publico.correo, "ana@escuela.ec");
    assert.equal(repo.guardados[0].hash, "hash(clave12345)");
    assert.ok(!JSON.stringify(repo.guardados[0]).includes('"clave12345"'));
  });

  it("rechaza contraseñas cortas y datos inválidos sin tocar la base", async () => {
    const repo = new DocenteRepositoryFalso();
    const caso = new RegistrarDocente(repo, hasheadorFalso);
    await assert.rejects(caso.ejecutar({ ...datos, contrasena: "corta" }), EntradaInvalida);
    await assert.rejects(caso.ejecutar({ ...datos, correo: "no-es-correo" }), EntradaInvalida);
    await assert.rejects(caso.ejecutar({}), EntradaInvalida);
    assert.equal(repo.guardados.length, 0);
  });
});

describe("Caso de uso ObtenerDocentePorId", () => {
  it("devuelve la vista pública o NoEncontrado", async () => {
    const repo = new DocenteRepositoryFalso();
    const { id } = await new RegistrarDocente(repo, hasheadorFalso).ejecutar(datos);
    const caso = new ObtenerDocentePorId(repo);
    assert.equal((await caso.ejecutar(id, id)).nombre, "Ana Pérez");
    await assert.rejects(caso.ejecutar(id, "999"), NoEncontrado);
    await assert.rejects(caso.ejecutar("otro-docente", id), NoEncontrado, "otro docente no ve la cuenta");
  });
});

describe("HasheadorContrasenaScrypt", () => {
  it("verifica la contraseña correcta, rechaza la incorrecta y usa sal distinta", async () => {
    const h = new HasheadorContrasenaScrypt();
    const a = await h.hashear("clave12345");
    const b = await h.hashear("clave12345");
    assert.notEqual(a, b);
    assert.equal(await h.verificar("clave12345", a), true);
    assert.equal(await h.verificar("otra-clave", a), false);
    assert.equal(await h.verificar("clave12345", "basura"), false);
  });
});

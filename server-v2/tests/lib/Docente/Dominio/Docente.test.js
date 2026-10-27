const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Docente = require("../../../../src/lib/Docente/Dominio/Entidades/Docente");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const base = { nombre: "  Ana Pérez ", correo: "  Ana@Escuela.EC ", hash: "h" };

describe("Entidad Docente", () => {
  it("normaliza nombre y correo", () => {
    const d = new Docente(base);
    assert.equal(d.nombre, "Ana Pérez");
    assert.equal(d.correo, "ana@escuela.ec");
  });

  it("la vista pública no incluye el hash", () => {
    const publico = new Docente(base).aPublico();
    assert.equal(publico.hash, undefined);
    assert.equal(publico.correo, "ana@escuela.ec");
  });

  it("rechaza datos inválidos", () => {
    for (const malo of [
      { ...base, nombre: "A" },
      { ...base, nombre: "x".repeat(81) },
      { ...base, nombre: undefined },
      { ...base, correo: "no-es-correo" },
      { ...base, correo: undefined },
      { ...base, institucion: "x".repeat(101) },
      { ...base, institucion: "<script>" }
    ]) {
      assert.throws(() => new Docente(malo), EntradaInvalida);
    }
  });

  it("acepta institución opcional y hash ausente", () => {
    const d = new Docente({ nombre: "Luis", correo: "l@x.ec", institucion: "Escuela Central" });
    assert.equal(d.institucion, "Escuela Central");
    assert.equal(d.hash, undefined);
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const DocenteController = require("../../../../src/lib/Docente/Infraestructura/http/DocenteController");

const crearRes = () => {
  const res = { codigo: null, cuerpo: null };
  res.status = (c) => ((res.codigo = c), res);
  res.json = (b) => ((res.cuerpo = b), res);
  res.setHeader = () => res;
  res.set = () => res;
  res.header = () => res;
  res.cookie = () => res;
  return res;
};

// Sesión falsa: regenerate responde con el error indicado (o éxito) como lo haría express-session
const reqConSesion = (errorAlRegenerar) => ({
  body: { nombre: "Ana", correo: "a@b.ec", contrasena: "clave12345" },
  session: {
    regenerate: (cb) => cb(errorAlRegenerar),
    save: (cb) => cb(),
    destroy: (cb) => cb()
  }
});

describe("DocenteController.registrar", () => {
  it("si la sesión no se puede abrir, deshace la cuenta y propaga el error", async () => {
    const eliminadas = [];
    const falloMongo = Object.assign(new Error("sin Mongo"), { name: "MongoServerSelectionError" });
    const controller = new DocenteController({
      registrarDocente: { ejecutar: async () => ({ id: "doc-1" }) },
      eliminarDocente: { ejecutar: async (quien, cual) => eliminadas.push([quien, cual]) }
    });
    await assert.rejects(() => controller.registrar(reqConSesion(falloMongo), crearRes()), (e) => e === falloMongo);
    assert.deepEqual(eliminadas, [["doc-1", "doc-1"]]);
  });

  it("si deshacer también falla, igual propaga el error original", async () => {
    const original = new Error("sesión");
    const controller = new DocenteController({
      registrarDocente: { ejecutar: async () => ({ id: "doc-2" }) },
      eliminarDocente: { ejecutar: async () => { throw new Error("tampoco"); } }
    });
    const consola = console.error;
    console.error = () => {};
    try {
      await assert.rejects(() => controller.registrar(reqConSesion(original), crearRes()), (e) => e === original);
    } finally {
      console.error = consola;
    }
  });

  it("con la sesión abierta no deshace nada y responde 201", async () => {
    let eliminado = false;
    const res = crearRes();
    const controller = new DocenteController({
      registrarDocente: { ejecutar: async () => ({ id: "doc-3" }) },
      eliminarDocente: { ejecutar: async () => { eliminado = true; } }
    });
    await controller.registrar(reqConSesion(null), res);
    assert.equal(res.codigo, 201);
    assert.equal(eliminado, false);
  });
});

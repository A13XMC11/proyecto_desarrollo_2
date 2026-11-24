const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { estadoDeError, MENSAJE_NO_DISPONIBLE } = require("../../../src/Infraestructura/http/estadoDeError");

const conNombre = (name, message = "x") => Object.assign(new Error(message), { name });

describe("estadoDeError", () => {
  it("conserva el statusCode de los errores de dominio", () => {
    assert.deepEqual(estadoDeError(Object.assign(new Error("No existe"), { statusCode: 404 })), { status: 404, message: "No existe" });
  });

  it("traduce unicidad a 409 y validación a 400", () => {
    assert.equal(estadoDeError(Object.assign(new Error("dup"), { code: 11000 })).status, 409);
    assert.equal(estadoDeError(conNombre("SequelizeUniqueConstraintError")).status, 409);
    assert.equal(estadoDeError(conNombre("ValidationError")).status, 400);
  });

  it("una base de datos caída es 503, no 500", () => {
    for (const nombre of ["MongoServerSelectionError", "MongooseServerSelectionError", "MongoNetworkError", "SequelizeConnectionRefusedError", "SequelizeConnectionError"]) {
      assert.deepEqual(estadoDeError(conNombre(nombre)), { status: 503, message: MENSAJE_NO_DISPONIBLE }, nombre);
    }
    assert.equal(estadoDeError(conNombre("MongooseError", "Operation `x.find()` buffering timed out after 10000ms")).status, 503);
  });

  it("cualquier otro error es 500 sin filtrar detalles", () => {
    assert.deepEqual(estadoDeError(new Error("secreto interno")), { status: 500, message: "Error interno del servidor" });
    assert.equal(estadoDeError(conNombre("MongooseError", "otra cosa")).status, 500);
  });
});

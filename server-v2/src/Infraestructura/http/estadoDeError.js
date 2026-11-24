// Traduce un error a la respuesta HTTP. Los errores de dominio ya traen statusCode; los de los motores de
// base de datos que el repositorio no tradujo se responden aquí.
const MENSAJE_NO_DISPONIBLE = "El servicio no está disponible por ahora. Intenta de nuevo en un momento.";

const ERRORES_DE_VALIDACION = ["ValidationError", "CastError", "SequelizeValidationError", "SequelizeForeignKeyConstraintError"];

// Una base de datos que no responde no es culpa del cliente ni un fallo de programación: es 503
function esBaseNoDisponible(err) {
  const nombre = String(err.name || "");
  if (/^Mongo(ose)?(Server)?Selection|^MongoNetwork|^MongoNotConnected|^SequelizeConnection|^SequelizeHostNotFound/.test(nombre)) return true;
  return nombre === "MongooseError" && /buffering timed out/i.test(String(err.message || ""));
}

function estadoDeError(err) {
  if (err.statusCode) return { status: err.statusCode, message: err.message };
  if (err.code === 11000 || err.name === "SequelizeUniqueConstraintError") {
    return { status: 409, message: "Ya existe un registro con esos datos" };
  }
  if (ERRORES_DE_VALIDACION.includes(err.name)) {
    return { status: 400, message: "Los datos no cumplen las reglas de validación" };
  }
  if (esBaseNoDisponible(err)) return { status: 503, message: MENSAJE_NO_DISPONIBLE };
  // Cualquier otro error (incluidos los SQL inesperados) es del servidor, no del cliente
  return { status: 500, message: "Error interno del servidor" };
}

module.exports = { estadoDeError, esBaseNoDisponible, MENSAJE_NO_DISPONIBLE };

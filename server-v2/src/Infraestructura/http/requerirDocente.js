const NoAutenticado = require("../../lib/Compartido/Dominio/Errores/NoAutenticado");

// Identifica al docente mientras no exista la sesión (sprint de acceso): cabecera x-docente-id.
// Cuando haya sesión, solo cambia este archivo.
module.exports = function requerirDocente(req, res, next) {
  const docenteId = req.get("x-docente-id");
  if (!docenteId) return next(new NoAutenticado("Falta identificar al docente (cabecera x-docente-id)"));
  req.docenteId = docenteId;
  next();
};

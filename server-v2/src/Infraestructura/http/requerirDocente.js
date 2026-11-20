const NoAutenticado = require("../../lib/Compartido/Dominio/Errores/NoAutenticado");
const { csrfValido, DURACION_MAXIMA_MS } = require("./sesion");

const METODOS_SEGUROS = ["GET", "HEAD", "OPTIONS"];

// Identifica al docente por su sesión (cookie). Nunca se confía en un id que llegue en la petición.
// En operaciones que cambian datos exige además el token CSRF de la sesión (cabecera X-CSRF-Token).
module.exports = function requerirDocente(req, res, next) {
  const sesion = req.session;
  if (!sesion || typeof sesion.docenteId !== "string") {
    return next(new NoAutenticado("Inicia sesión para continuar", "SESION_REQUERIDA"));
  }

  // Duración máxima: aunque haya actividad, a las 12 h hay que volver a entrar
  if (!sesion.iniciadaEn || Date.now() - sesion.iniciadaEn > DURACION_MAXIMA_MS) {
    return sesion.destroy(() => next(new NoAutenticado("Tu sesión terminó. Vuelve a entrar.", "SESION_EXPIRADA")));
  }

  if (!METODOS_SEGUROS.includes(req.method) && !csrfValido(req)) {
    // Error de transporte, no de dominio: se responde 403 con un código estable
    const error = new Error("La solicitud no se pudo verificar. Recarga la página e inténtalo de nuevo.");
    error.statusCode = 403;
    error.codigo = "CSRF_INVALIDO";
    return next(error);
  }

  req.docenteId = sesion.docenteId;
  next();
};

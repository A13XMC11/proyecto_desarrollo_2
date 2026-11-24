const NoAutenticado = require("../../lib/Compartido/Dominio/Errores/NoAutenticado");
const { csrfValido, DURACION_ESTUDIANTE_MS } = require("./sesion");

const METODOS_SEGUROS = ["GET", "HEAD", "OPTIONS"];

// Identifica al estudiante por su sesión. Deja en la petición solo lo que el servidor guardó al entrar:
// ningún id llega desde el cliente. docenteId es el dueño del curso (los casos de uso lo exigen).
module.exports = function requerirEstudiante(req, res, next) {
  const estudiante = req.session && req.session.estudiante;
  if (!estudiante || typeof estudiante.estudianteId !== "string") {
    return next(new NoAutenticado("Escribe el código de tu curso para jugar", "ESTUDIANTE_REQUERIDO"));
  }
  if (Date.now() - estudiante.iniciadaEn > DURACION_ESTUDIANTE_MS) {
    delete req.session.estudiante;
    return req.session.save(() => next(new NoAutenticado("Tu tiempo terminó. Escribe tu código otra vez.", "ESTUDIANTE_EXPIRADO")));
  }
  if (!METODOS_SEGUROS.includes(req.method) && !csrfValido(req)) {
    const error = new Error("La solicitud no se pudo verificar. Recarga la página e inténtalo de nuevo.");
    error.statusCode = 403;
    error.codigo = "CSRF_INVALIDO";
    return next(error);
  }
  req.docenteId = estudiante.docenteId;
  req.cursoId = estudiante.cursoId;
  req.estudianteId = estudiante.estudianteId;
  next();
};

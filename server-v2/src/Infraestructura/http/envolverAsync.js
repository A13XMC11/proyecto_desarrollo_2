// Express 4 no captura el rechazo de un manejador async: sin esto la petición queda colgada.
// Reenvía el error al manejador global de app.js.
module.exports = function envolverAsync(manejador) {
  return (req, res, next) => Promise.resolve(manejador(req, res, next)).catch(next);
};

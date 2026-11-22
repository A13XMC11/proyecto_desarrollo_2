const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

// Montadas en /api: GET /api/resultados y GET /api/inicio (solo lectura)
module.exports = function ResultadoRoutes(controller) {
  const router = express.Router();

  router.get("/resultados", requerirDocente, envolverAsync(controller.resultados));
  router.get("/inicio", requerirDocente, envolverAsync(controller.inicio));

  return router;
};

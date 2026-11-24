const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

// Montadas en /api: GET /api/resultados, GET /api/resultados/repaso, POST /api/resultados/repaso/recomendacion y GET /api/inicio
module.exports = function ResultadoRoutes(controller) {
  const router = express.Router();

  router.get("/resultados", requerirDocente, envolverAsync(controller.resultados));
  router.get("/resultados/repaso", requerirDocente, envolverAsync(controller.repaso));
  router.post("/resultados/repaso/recomendacion", requerirDocente, envolverAsync(controller.recomendacion));
  router.get("/inicio", requerirDocente, envolverAsync(controller.inicio));

  return router;
};

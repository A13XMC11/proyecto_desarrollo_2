const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

module.exports = function CuotaRoutes(controller) {
  const router = express.Router();
  router.use(requerirDocente);

  router.get("/", envolverAsync(controller.consultar));

  return router;
};

const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

// Se monta en /api/iconos (solo lectura)
module.exports = function IconoRoutes(controller) {
  const router = express.Router();
  router.use(requerirDocente);
  router.get("/", envolverAsync(controller.listar));
  return router;
};

const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");

// Catálogo fijo de 4 canales: solo lectura
module.exports = function CanalRoutes(controller) {
  const router = express.Router();

  router.get("/", envolverAsync(controller.listar));
  router.get("/:codigo", envolverAsync(controller.obtenerPorCodigo));

  return router;
};

const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

module.exports = function GeneracionRoutes(controller) {
  const router = express.Router();
  router.use(requerirDocente);

  router.post("/", envolverAsync(controller.solicitar));
  router.get("/", envolverAsync(controller.listar));
  router.get("/:id", envolverAsync(controller.obtenerPorId));
  router.delete("/:id", envolverAsync(controller.eliminar));

  return router;
};

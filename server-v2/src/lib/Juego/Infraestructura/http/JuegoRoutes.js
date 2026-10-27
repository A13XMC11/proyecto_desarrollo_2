const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

module.exports = function JuegoRoutes(controller) {
  const router = express.Router();
  router.use(requerirDocente);

  router.post("/", envolverAsync(controller.crear));
  router.get("/", envolverAsync(controller.listar));
  router.get("/:id", envolverAsync(controller.obtenerPorId));
  router.put("/:id", envolverAsync(controller.actualizar));
  router.delete("/:id", envolverAsync(controller.eliminar));
  router.post("/:id/desarchivar", envolverAsync(controller.desarchivar));

  return router;
};

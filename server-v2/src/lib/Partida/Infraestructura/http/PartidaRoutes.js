const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

module.exports = function PartidaRoutes(controller) {
  const router = express.Router();
  router.use(requerirDocente);

  router.post("/", envolverAsync(controller.iniciar));
  router.get("/", envolverAsync(controller.listar));
  router.get("/:id", envolverAsync(controller.obtenerPorId));
  router.post("/:id/intentos", envolverAsync(controller.intento));
  router.post("/:id/pistas", envolverAsync(controller.pista));
  router.post("/:id/finalizar", envolverAsync(controller.finalizar));
  router.delete("/:id", envolverAsync(controller.eliminar));

  return router;
};

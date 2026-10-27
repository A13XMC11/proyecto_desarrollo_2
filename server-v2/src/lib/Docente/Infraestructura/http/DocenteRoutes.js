const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

module.exports = function DocenteRoutes(controller) {
  const router = express.Router();

  router.post("/", envolverAsync(controller.registrar)); // el registro es público
  router.get("/", requerirDocente, envolverAsync(controller.listar));
  router.get("/:id", requerirDocente, envolverAsync(controller.obtenerPorId));
  router.put("/:id", requerirDocente, envolverAsync(controller.actualizar));
  router.delete("/:id", requerirDocente, envolverAsync(controller.eliminar));

  return router;
};

const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

// Se monta en /api/juegos/:juegoId/versiones
module.exports = function VersionRoutes(controller) {
  const router = express.Router({ mergeParams: true });
  router.use(requerirDocente);

  router.post("/", envolverAsync(controller.crear));
  router.get("/", envolverAsync(controller.listar));
  router.get("/:id", envolverAsync(controller.obtenerPorId));
  router.put("/:id", envolverAsync(controller.actualizar));
  router.post("/:id/aprobar", envolverAsync(controller.aprobar));
  router.delete("/:id", envolverAsync(controller.eliminar));

  return router;
};

const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

module.exports = function DocenteRoutes(controller) {
  const router = express.Router();

  router.post("/", envolverAsync(controller.registrar)); // registrarse es público y abre la sesión
  // Sesión: antes que "/:id" para que "sesion" no se lea como un id
  router.post("/sesion", envolverAsync(controller.entrar)); // entrar es público
  router.get("/sesion", requerirDocente, envolverAsync(controller.sesionActual));
  router.delete("/sesion", requerirDocente, envolverAsync(controller.salir));

  router.get("/", requerirDocente, envolverAsync(controller.listar));
  router.get("/:id", requerirDocente, envolverAsync(controller.obtenerPorId));
  router.put("/:id", requerirDocente, envolverAsync(controller.actualizar));
  router.delete("/:id", requerirDocente, envolverAsync(controller.eliminar));

  return router;
};

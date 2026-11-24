const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirEstudiante = require("../../../../Infraestructura/http/requerirEstudiante");

// /api/estudiante (con sesión de estudiante): lo único que alcanza quien entró con el código de su curso.
// La entrada (/ingresar, /salir) la atiende el módulo Aula.
module.exports = function AccesoEstudianteRoutes(controller) {
  const router = express.Router();

  router.use(requerirEstudiante);
  router.get("/yo", envolverAsync(controller.yo));
  router.get("/juegos", envolverAsync(controller.juegos));
  router.post("/partidas", envolverAsync(controller.iniciar));

  router.use("/partidas/:id", envolverAsync(controller.verificarPropia));
  router.get("/partidas/:id/jugable", envolverAsync(controller.jugable));
  router.post("/partidas/:id/intentos", envolverAsync(controller.intento));
  router.post("/partidas/:id/pistas", envolverAsync(controller.pista));

  return router;
};

const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const requerirDocente = require("../../../../Infraestructura/http/requerirDocente");

// Registro de eventos append-only: se crea y se consulta, nunca se edita ni se elimina
module.exports = function InteraccionRoutes(controller) {
  const router = express.Router();
  router.use(requerirDocente);

  router.post("/", envolverAsync(controller.registrar));
  router.get("/", envolverAsync(controller.listar));

  return router;
};

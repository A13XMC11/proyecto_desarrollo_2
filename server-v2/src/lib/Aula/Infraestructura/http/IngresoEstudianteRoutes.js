const express = require("express");
const envolverAsync = require("../../../../Infraestructura/http/envolverAsync");
const { crearLimitadorDeFallos } = require("../../../../Infraestructura/http/limitarFallos");

// Puerta pública de los estudiantes. Los intentos fallidos se cuentan por IP para frenar el adivinar códigos.
// El resto de /api/estudiante (con sesión) lo atiende el módulo Partida.
module.exports = function IngresoEstudianteRoutes(controller) {
  const router = express.Router();
  const limitador = crearLimitadorDeFallos();

  router.post(
    "/ingresar",
    envolverAsync(async (req, res) => {
      limitador.revisar(req.ip);
      try {
        await controller.ingresar(req, res);
      } catch (error) {
        if (error.codigo === "ACCESO_INVALIDO") limitador.registrarFallo(req.ip);
        throw error;
      }
    })
  );
  router.post("/salir", envolverAsync(controller.salir));

  return router;
};

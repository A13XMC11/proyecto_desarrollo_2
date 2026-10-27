const express = require("express");
const cors = require("cors");

const registerDocenteModule = require("./lib/Docente/Infraestructura/http"); // auto-usa index.js del módulo
const registerAulaModule = require("./lib/Aula/Infraestructura/http");
const registerJuegoModule = require("./lib/Juego/Infraestructura/http");
const registerCanalModule = require("./lib/Canal/Infraestructura/http");
const registerGeneracionModule = require("./lib/Generacion/Infraestructura/http");
const registerPartidaModule = require("./lib/Partida/Infraestructura/http");

// Errores de los motores de base de datos que el repositorio no tradujo: se responden aquí
function estadoDeError(err) {
  if (err.statusCode) return { status: err.statusCode, message: err.message };
  if (err.code === 11000 || err.name === "SequelizeUniqueConstraintError") {
    return { status: 409, message: "Ya existe un registro con esos datos" };
  }
  if (["ValidationError", "CastError", "SequelizeValidationError", "SequelizeForeignKeyConstraintError"].includes(err.name)) {
    return { status: 400, message: "Los datos no cumplen las reglas de validación" };
  }
  // Cualquier otro error (incluidos los SQL inesperados) es del servidor, no del cliente
  return { status: 500, message: "Error interno del servidor" };
}

function buildApp() {
  const app = express();

  // Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  // Módulos
  registerDocenteModule(app);
  registerAulaModule(app);
  registerJuegoModule(app);
  registerCanalModule(app);
  registerGeneracionModule(app);
  registerPartidaModule(app);

  // 404 (opcional, recomendado)
  app.use((req, res) => res.status(404).json({ message: "Ruta no encontrada" }));

  // Error handler (opcional, recomendado)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const { status, message } = estadoDeError(err);
    // Los errores de motor traducidos a 4xx se registran igualmente: ocultan fallos de programación
    if (status >= 500) console.error(err);
    else if (!err.statusCode) console.warn(`${err.name}: ${err.message}`);
    res.status(status).json({ message });
  });

  return app;
}

module.exports = buildApp;

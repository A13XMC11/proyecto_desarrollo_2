const express = require("express");
const cors = require("cors");
const { crearMiddlewareSesion } = require("./Infraestructura/http/sesion");
const { estadoDeError } = require("./Infraestructura/http/estadoDeError");
const { manejadorSalud } = require("./Infraestructura/http/salud");

const registerDocenteModule = require("./lib/Docente/Infraestructura/http"); // auto-usa index.js del módulo
const registerAulaModule = require("./lib/Aula/Infraestructura/http");
const registerJuegoModule = require("./lib/Juego/Infraestructura/http");
const registerCanalModule = require("./lib/Canal/Infraestructura/http");
const registerGeneracionModule = require("./lib/Generacion/Infraestructura/http");
const registerPartidaModule = require("./lib/Partida/Infraestructura/http");

function buildApp() {
  const app = express();

  // Detrás de un proxy HTTPS (producción) la cookie Secure necesita confiar en X-Forwarded-Proto
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

  // Middlewares
  // CORS solo para los orígenes de APP_ORIGIN (separados por coma) y con credenciales. Sin APP_ORIGIN no se
  // abre a otros orígenes: en desarrollo el cliente llega por el proxy de Vite (mismo origen).
  const origenes = (process.env.APP_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
  app.use(cors({ origin: origenes.length ? origenes : false, credentials: true, exposedHeaders: ["X-CSRF-Token"] }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Salud antes de la sesión: debe responder (503) aunque MongoDB, que guarda las sesiones, esté caído
  app.get("/api/health", manejadorSalud());

  app.use(crearMiddlewareSesion());

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
    // codigo estable para que el cliente decida qué mostrar (solo en errores de dominio)
    res.status(status).json(err.statusCode && err.codigo ? { message, codigo: err.codigo } : { message });
  });

  return app;
}

module.exports = buildApp;

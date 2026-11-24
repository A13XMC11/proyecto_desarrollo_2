const DocenteRoutes = require("./DocenteRoutes");
const DocenteController = require("./DocenteController");

const DocenteRepositorySequelize = require("../DocenteRepositorySequelize");
const HasheadorContrasenaScrypt = require("../HasheadorContrasenaScrypt");
const LimitadorIntentosLogin = require("../LimitadorIntentosLogin");

const RegistrarDocente = require("../../Aplicacion/RegistrarDocente");
const ObtenerDocentePorId = require("../../Aplicacion/ObtenerDocentePorId");
const ListarDocentes = require("../../Aplicacion/ListarDocentes");
const ActualizarDocente = require("../../Aplicacion/ActualizarDocente");
const EliminarDocente = require("../../Aplicacion/EliminarDocente");
const IniciarSesion = require("../../Aplicacion/IniciarSesion");
const ObtenerDocenteActual = require("../../Aplicacion/ObtenerDocenteActual");

module.exports = function registerDocenteModule(app) {
  const repo = new DocenteRepositorySequelize();
  const hasheador = new HasheadorContrasenaScrypt();
  const limitadorLogin = new LimitadorIntentosLogin();
  setInterval(() => limitadorLogin.limpiar(), 10 * 60 * 1000).unref(); // sin retener el proceso

  const controller = new DocenteController({
    registrarDocente: new RegistrarDocente(repo, hasheador),
    listarDocentes: new ListarDocentes(repo),
    obtenerDocentePorId: new ObtenerDocentePorId(repo),
    obtenerDocenteActual: new ObtenerDocenteActual(repo),
    actualizarDocente: new ActualizarDocente(repo),
    eliminarDocente: new EliminarDocente(repo),
    iniciarSesion: new IniciarSesion(repo, hasheador),
    limitadorLogin
  });

  app.use("/api/docentes", DocenteRoutes(controller));
};

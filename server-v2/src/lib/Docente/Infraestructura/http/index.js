const DocenteRoutes = require("./DocenteRoutes");
const DocenteController = require("./DocenteController");

const DocenteRepositorySequelize = require("../DocenteRepositorySequelize");
const HasheadorContrasenaScrypt = require("../HasheadorContrasenaScrypt");

const RegistrarDocente = require("../../Aplicacion/RegistrarDocente");
const ObtenerDocentePorId = require("../../Aplicacion/ObtenerDocentePorId");
const ListarDocentes = require("../../Aplicacion/ListarDocentes");
const ActualizarDocente = require("../../Aplicacion/ActualizarDocente");
const EliminarDocente = require("../../Aplicacion/EliminarDocente");

module.exports = function registerDocenteModule(app) {
  const repo = new DocenteRepositorySequelize();
  const hasheador = new HasheadorContrasenaScrypt();

  const controller = new DocenteController({
    registrarDocente: new RegistrarDocente(repo, hasheador),
    listarDocentes: new ListarDocentes(repo),
    obtenerDocentePorId: new ObtenerDocentePorId(repo),
    actualizarDocente: new ActualizarDocente(repo),
    eliminarDocente: new EliminarDocente(repo)
  });

  app.use("/api/docentes", DocenteRoutes(controller));
};

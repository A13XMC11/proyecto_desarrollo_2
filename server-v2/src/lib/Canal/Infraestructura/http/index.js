const CanalRoutes = require("./CanalRoutes");
const CanalController = require("./CanalController");

const CanalRepositoryMongoose = require("../CanalRepositoryMongoose");

const AsegurarCanales = require("../../Aplicacion/AsegurarCanales");
const ListarCanales = require("../../Aplicacion/ListarCanales");
const ObtenerCanalPorCodigo = require("../../Aplicacion/ObtenerCanalPorCodigo");

// Los canales se crean al arrancar (los exigen Generacion y Partida): ver server.js
function crearAsegurarCanales() {
  return new AsegurarCanales(new CanalRepositoryMongoose());
}

function registerCanalModule(app) {
  const repo = new CanalRepositoryMongoose();

  const controller = new CanalController({
    listarCanales: new ListarCanales(repo),
    obtenerCanalPorCodigo: new ObtenerCanalPorCodigo(repo)
  });

  app.use("/api/canales", CanalRoutes(controller));
}

module.exports = registerCanalModule;
module.exports.crearAsegurarCanales = crearAsegurarCanales;

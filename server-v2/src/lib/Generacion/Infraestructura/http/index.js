const GeneracionRoutes = require("./GeneracionRoutes");
const GeneracionController = require("./GeneracionController");
const CuotaRoutes = require("./CuotaRoutes");
const CuotaController = require("./CuotaController");

const GeneracionRepositorySequelize = require("../GeneracionRepositorySequelize");
const CuotaRepositorySequelize = require("../CuotaRepositorySequelize");
// Generacion valida el curso y el estudiante (PostgreSQL) y el canal (MongoDB) a través de sus repositorios
const CursoRepositorySequelize = require("../../../Aula/Infraestructura/CursoRepositorySequelize");
const EstudianteRepositorySequelize = require("../../../Aula/Infraestructura/EstudianteRepositorySequelize");
const CanalRepositoryMongoose = require("../../../Canal/Infraestructura/CanalRepositoryMongoose");

const SolicitarGeneracion = require("../../Aplicacion/SolicitarGeneracion");
const ListarGeneraciones = require("../../Aplicacion/ListarGeneraciones");
const ObtenerGeneracion = require("../../Aplicacion/ObtenerGeneracion");
const CancelarGeneracion = require("../../Aplicacion/CancelarGeneracion");
const ConsultarCuotas = require("../../Aplicacion/ConsultarCuotas");

module.exports = function registerGeneracionModule(app) {
  const repo = new GeneracionRepositorySequelize();
  const cuotaRepo = new CuotaRepositorySequelize();

  const generacionController = new GeneracionController({
    solicitarGeneracion: new SolicitarGeneracion(
      repo, new CursoRepositorySequelize(), new EstudianteRepositorySequelize(), new CanalRepositoryMongoose()
    ),
    listarGeneraciones: new ListarGeneraciones(repo),
    obtenerGeneracion: new ObtenerGeneracion(repo),
    cancelarGeneracion: new CancelarGeneracion(repo)
  });

  const cuotaController = new CuotaController({ consultarCuotas: new ConsultarCuotas(cuotaRepo) });

  app.use("/api/generaciones", GeneracionRoutes(generacionController));
  app.use("/api/cuotas", CuotaRoutes(cuotaController));
};

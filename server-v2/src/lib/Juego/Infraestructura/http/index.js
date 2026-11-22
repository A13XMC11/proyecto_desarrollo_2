const JuegoRoutes = require("./JuegoRoutes");
const JuegoController = require("./JuegoController");
const VersionRoutes = require("./VersionRoutes");
const VersionController = require("./VersionController");
const RecursoRoutes = require("./RecursoRoutes");
const RecursoController = require("./RecursoController");

const JuegoRepositoryMongoose = require("../JuegoRepositoryMongoose");
const VersionRepositoryMongoose = require("../VersionRepositoryMongoose");
const CatalogoRecursosJson = require("../CatalogoRecursosJson");
// El módulo Juego consulta cursos y estudiantes (PostgreSQL) a través de sus repositorios
const CursoRepositorySequelize = require("../../../Aula/Infraestructura/CursoRepositorySequelize");
const EstudianteRepositorySequelize = require("../../../Aula/Infraestructura/EstudianteRepositorySequelize");

const CrearJuego = require("../../Aplicacion/CrearJuego");
const ListarJuegos = require("../../Aplicacion/ListarJuegos");
const ObtenerJuegoPorId = require("../../Aplicacion/ObtenerJuegoPorId");
const ActualizarJuego = require("../../Aplicacion/ActualizarJuego");
const ArchivarJuego = require("../../Aplicacion/ArchivarJuego");
const DesarchivarJuego = require("../../Aplicacion/DesarchivarJuego");
const CrearVersion = require("../../Aplicacion/CrearVersion");
const ListarVersiones = require("../../Aplicacion/ListarVersiones");
const ObtenerVersion = require("../../Aplicacion/ObtenerVersion");
const ActualizarVersion = require("../../Aplicacion/ActualizarVersion");
const AprobarVersion = require("../../Aplicacion/AprobarVersion");
const DescartarVersion = require("../../Aplicacion/DescartarVersion");
const ListarRecursos = require("../../Aplicacion/ListarRecursos");

module.exports = function registerJuegoModule(app) {
  const repo = new JuegoRepositoryMongoose();
  const versionRepo = new VersionRepositoryMongoose();
  // Si el catálogo es incoherente, el servidor no arranca. Los 10 ejercicios están habilitados por defecto (sprint 7); PERMITIR_10_EJERCICIOS=false los apaga.
  const catalogo = new CatalogoRecursosJson();
  const validacion = { permitirDiez: process.env.PERMITIR_10_EJERCICIOS !== "false" };

  const juegoController = new JuegoController({
    crearJuego: new CrearJuego(repo, new CursoRepositorySequelize(), new EstudianteRepositorySequelize()),
    listarJuegos: new ListarJuegos(repo),
    obtenerJuegoPorId: new ObtenerJuegoPorId(repo),
    actualizarJuego: new ActualizarJuego(repo),
    archivarJuego: new ArchivarJuego(repo),
    desarchivarJuego: new DesarchivarJuego(repo)
  });

  const versionController = new VersionController({
    crearVersion: new CrearVersion(versionRepo, repo, catalogo, validacion),
    listarVersiones: new ListarVersiones(versionRepo, repo),
    obtenerVersion: new ObtenerVersion(versionRepo, repo),
    actualizarVersion: new ActualizarVersion(versionRepo, repo, catalogo, validacion),
    aprobarVersion: new AprobarVersion(versionRepo, repo, catalogo, validacion),
    descartarVersion: new DescartarVersion(versionRepo, repo)
  });

  const recursoController = new RecursoController({ listarRecursos: new ListarRecursos(catalogo) });

  app.use("/api/recursos", RecursoRoutes(recursoController));
  app.use("/api/juegos/:juegoId/versiones", VersionRoutes(versionController));
  app.use("/api/juegos", JuegoRoutes(juegoController));
};

const PartidaRoutes = require("./PartidaRoutes");
const PartidaController = require("./PartidaController");
const InteraccionRoutes = require("./InteraccionRoutes");
const InteraccionController = require("./InteraccionController");

const SesionJuegoRepositoryMongoose = require("../SesionJuegoRepositoryMongoose");
const InteraccionRepositoryMongoose = require("../InteraccionRepositoryMongoose");
// Partida consulta juegos, versiones y canales (MongoDB) y estudiantes (PostgreSQL) a través de sus repositorios
const JuegoRepositoryMongoose = require("../../../Juego/Infraestructura/JuegoRepositoryMongoose");
const VersionRepositoryMongoose = require("../../../Juego/Infraestructura/VersionRepositoryMongoose");
const CanalRepositoryMongoose = require("../../../Canal/Infraestructura/CanalRepositoryMongoose");
const EstudianteRepositorySequelize = require("../../../Aula/Infraestructura/EstudianteRepositorySequelize");

const IniciarPartida = require("../../Aplicacion/IniciarPartida");
const ListarPartidas = require("../../Aplicacion/ListarPartidas");
const ObtenerPartida = require("../../Aplicacion/ObtenerPartida");
const ObtenerPartidaJugable = require("../../Aplicacion/ObtenerPartidaJugable");
const RegistrarIntento = require("../../Aplicacion/RegistrarIntento");
const RegistrarPista = require("../../Aplicacion/RegistrarPista");
const FinalizarPartida = require("../../Aplicacion/FinalizarPartida");
const AbandonarPartida = require("../../Aplicacion/AbandonarPartida");
const RegistrarInteraccion = require("../../Aplicacion/RegistrarInteraccion");
const ListarInteracciones = require("../../Aplicacion/ListarInteracciones");

module.exports = function registerPartidaModule(app) {
  const repo = new SesionJuegoRepositoryMongoose();
  const versionRepo = new VersionRepositoryMongoose();
  const canalRepo = new CanalRepositoryMongoose();
  const interaccionRepo = new InteraccionRepositoryMongoose();

  const juegoRepo = new JuegoRepositoryMongoose();

  const controller = new PartidaController({
    iniciarPartida: new IniciarPartida(repo, juegoRepo, new EstudianteRepositorySequelize(), canalRepo),
    obtenerPartidaJugable: new ObtenerPartidaJugable(repo, juegoRepo, versionRepo),
    listarPartidas: new ListarPartidas(repo),
    obtenerPartida: new ObtenerPartida(repo),
    registrarIntento: new RegistrarIntento(repo, versionRepo),
    registrarPista: new RegistrarPista(repo, versionRepo),
    finalizarPartida: new FinalizarPartida(repo),
    abandonarPartida: new AbandonarPartida(repo)
  });

  const interaccionController = new InteraccionController({
    registrarInteraccion: new RegistrarInteraccion(interaccionRepo, canalRepo, repo),
    listarInteracciones: new ListarInteracciones(interaccionRepo, repo)
  });

  app.use("/api/partidas", PartidaRoutes(controller));
  app.use("/api/interacciones", InteraccionRoutes(interaccionController));
};

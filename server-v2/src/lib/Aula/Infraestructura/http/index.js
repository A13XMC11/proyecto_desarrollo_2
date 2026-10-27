const CursoRoutes = require("./CursoRoutes");
const CursoController = require("./CursoController");
const EstudianteRoutes = require("./EstudianteRoutes");
const EstudianteController = require("./EstudianteController");

const CursoRepositorySequelize = require("../CursoRepositorySequelize");
const EstudianteRepositorySequelize = require("../EstudianteRepositorySequelize");

const CrearCurso = require("../../Aplicacion/CrearCurso");
const ListarCursos = require("../../Aplicacion/ListarCursos");
const ObtenerCursoPorId = require("../../Aplicacion/ObtenerCursoPorId");
const ActualizarCurso = require("../../Aplicacion/ActualizarCurso");
const ArchivarCurso = require("../../Aplicacion/ArchivarCurso");
const CrearEstudiante = require("../../Aplicacion/CrearEstudiante");
const ListarEstudiantes = require("../../Aplicacion/ListarEstudiantes");
const ObtenerEstudiantePorId = require("../../Aplicacion/ObtenerEstudiantePorId");
const ActualizarEstudiante = require("../../Aplicacion/ActualizarEstudiante");
const ArchivarEstudiante = require("../../Aplicacion/ArchivarEstudiante");

module.exports = function registerAulaModule(app) {
  const cursoRepo = new CursoRepositorySequelize();
  const estudianteRepo = new EstudianteRepositorySequelize();

  const cursoController = new CursoController({
    crearCurso: new CrearCurso(cursoRepo),
    listarCursos: new ListarCursos(cursoRepo),
    obtenerCursoPorId: new ObtenerCursoPorId(cursoRepo),
    actualizarCurso: new ActualizarCurso(cursoRepo),
    archivarCurso: new ArchivarCurso(cursoRepo)
  });

  const estudianteController = new EstudianteController({
    crearEstudiante: new CrearEstudiante(estudianteRepo, cursoRepo),
    listarEstudiantes: new ListarEstudiantes(estudianteRepo, cursoRepo),
    obtenerEstudiantePorId: new ObtenerEstudiantePorId(estudianteRepo),
    actualizarEstudiante: new ActualizarEstudiante(estudianteRepo),
    archivarEstudiante: new ArchivarEstudiante(estudianteRepo)
  });

  app.use("/api/cursos", CursoRoutes(cursoController));
  app.use("/api/estudiantes", EstudianteRoutes(estudianteController));
};

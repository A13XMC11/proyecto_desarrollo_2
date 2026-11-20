const GeneracionRoutes = require("./GeneracionRoutes");
const GeneracionController = require("./GeneracionController");
const CuotaRoutes = require("./CuotaRoutes");
const CuotaController = require("./CuotaController");

const GeneracionRepositorySequelize = require("../GeneracionRepositorySequelize");
const CuotaRepositorySequelize = require("../CuotaRepositorySequelize");
const GeneradorContenidoFalso = require("../GeneradorContenidoFalso");
// Generacion valida el curso y el estudiante (PostgreSQL) y el canal (MongoDB), y guarda el borrador
// en Juego (MongoDB), a través de los repositorios y el catálogo de esos módulos
const CursoRepositorySequelize = require("../../../Aula/Infraestructura/CursoRepositorySequelize");
const EstudianteRepositorySequelize = require("../../../Aula/Infraestructura/EstudianteRepositorySequelize");
const CanalRepositoryMongoose = require("../../../Canal/Infraestructura/CanalRepositoryMongoose");
const JuegoRepositoryMongoose = require("../../../Juego/Infraestructura/JuegoRepositoryMongoose");
const VersionRepositoryMongoose = require("../../../Juego/Infraestructura/VersionRepositoryMongoose");
const CatalogoRecursosJson = require("../../../Juego/Infraestructura/CatalogoRecursosJson");

const SolicitarGeneracion = require("../../Aplicacion/SolicitarGeneracion");
const ProcesarGeneracion = require("../../Aplicacion/ProcesarGeneracion");
const ConciliarGeneraciones = require("../../Aplicacion/ConciliarGeneraciones");
const LiquidarReserva = require("../../Aplicacion/LiquidarReserva");
const ListarGeneraciones = require("../../Aplicacion/ListarGeneraciones");
const ObtenerGeneracion = require("../../Aplicacion/ObtenerGeneracion");
const CancelarGeneracion = require("../../Aplicacion/CancelarGeneracion");
const ConsultarCuotas = require("../../Aplicacion/ConsultarCuotas");

const numero = (valor, porDefecto) => {
  const n = Number(valor);
  return valor !== undefined && valor !== "" && Number.isFinite(n) && n >= 0 ? n : porDefecto;
};

// Configuración leída una vez del entorno (ver .env.example)
function leerConfiguracion() {
  return {
    habilitada: process.env.AI_ENABLED === "true", // apagada por defecto (S4-08)
    permitirDiez: process.env.PERMITIR_10_EJERCICIOS === "true",
    limiteDiario: numero(process.env.IA_CUPO_DIARIO, 3),
    limiteGlobalMensual: numero(process.env.IA_CUPO_GLOBAL_MENSUAL, 100),
    zonaHoraria: process.env.ZONA_HORARIA || "America/Guayaquil",
    tiempoLimiteMs: numero(process.env.IA_TIEMPO_LIMITE_MS, 60000),
    demoraFalsoMs: numero(process.env.GENERADOR_FALSO_DEMORA_MS, 0)
  };
}

// Proveedor de contenido. Por ahora solo el falso (sin costo); el adaptador de Claude se añade al pasar
// a producción y solo cambia esta función.
function crearGenerador(config) {
  return new GeneradorContenidoFalso({ demoraMs: config.demoraFalsoMs });
}

function crearCasos(config = leerConfiguracion()) {
  const repo = new GeneracionRepositorySequelize();
  const cuotaRepo = new CuotaRepositorySequelize();
  const juegoRepo = new JuegoRepositoryMongoose();
  const liquidarReserva = new LiquidarReserva(repo, cuotaRepo);

  const conciliarGeneraciones = new ConciliarGeneraciones(
    { generacionRepository: repo, juegoRepository: juegoRepo, liquidarReserva },
    // Vencida = el doble del tiempo límite, con un mínimo de 5 minutos
    { vencimientoMs: Math.max(5 * 60 * 1000, config.tiempoLimiteMs * 2) }
  );
  const procesarGeneracion = new ProcesarGeneracion(
    {
      generacionRepository: repo,
      juegoRepository: juegoRepo,
      versionRepository: new VersionRepositoryMongoose(),
      catalogo: new CatalogoRecursosJson(),
      generador: crearGenerador(config),
      liquidarReserva
    },
    config
  );

  return { repo, cuotaRepo, liquidarReserva, conciliarGeneraciones, procesarGeneracion };
}

// Conciliación sin planificador (extensión 7): una vez al arrancar, ver server.js
function crearConciliarGeneraciones() {
  return crearCasos().conciliarGeneraciones;
}

function registerGeneracionModule(app) {
  const config = leerConfiguracion();
  const { repo, cuotaRepo, liquidarReserva, conciliarGeneraciones, procesarGeneracion } = crearCasos(config);

  const generacionController = new GeneracionController({
    solicitarGeneracion: new SolicitarGeneracion(
      {
        generacionRepository: repo,
        cuotaRepository: cuotaRepo,
        cursoRepository: new CursoRepositorySequelize(),
        estudianteRepository: new EstudianteRepositorySequelize(),
        canalRepository: new CanalRepositoryMongoose(),
        procesarGeneracion,
        conciliarGeneraciones
      },
      {
        ...config,
        // El proceso en segundo plano no tiene a quién responder: se registra y lo cierra la conciliación
        alFallarProceso: (error, generacion) => console.error(`Fallo procesando la generación ${generacion.id}:`, error)
      }
    ),
    listarGeneraciones: new ListarGeneraciones(repo, conciliarGeneraciones),
    obtenerGeneracion: new ObtenerGeneracion(repo, conciliarGeneraciones),
    cancelarGeneracion: new CancelarGeneracion(repo, liquidarReserva)
  });

  const cuotaController = new CuotaController({ consultarCuotas: new ConsultarCuotas(cuotaRepo, config) });

  app.use("/api/generaciones", GeneracionRoutes(generacionController));
  app.use("/api/cuotas", CuotaRoutes(cuotaController));
}

module.exports = registerGeneracionModule;
module.exports.crearConciliarGeneraciones = crearConciliarGeneraciones;

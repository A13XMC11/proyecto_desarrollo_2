const GeneracionRoutes = require("./GeneracionRoutes");
const GeneracionController = require("./GeneracionController");
const CuotaRoutes = require("./CuotaRoutes");
const CuotaController = require("./CuotaController");

const GeneracionRepositorySequelize = require("../GeneracionRepositorySequelize");
const CuotaRepositorySequelize = require("../CuotaRepositorySequelize");
const leerConfiguracionGeneracion = require("../leerConfiguracionGeneracion");
// Para cambiar de generador solo se modifica este archivo (GeneradorContenidoFalso <-> GeneradorContenidoIA)
const GeneradorContenidoFalso = require("../GeneradorContenidoFalso");
const GeneradorContenidoIA = require("../GeneradorContenidoIA");
// Generacion valida el curso y el estudiante (PostgreSQL) y el canal (MongoDB) a través de sus repositorios,
// y guarda el borrador en Juego (MongoDB) con su catálogo de recursos
const CursoRepositorySequelize = require("../../../Aula/Infraestructura/CursoRepositorySequelize");
const EstudianteRepositorySequelize = require("../../../Aula/Infraestructura/EstudianteRepositorySequelize");
const CanalRepositoryMongoose = require("../../../Canal/Infraestructura/CanalRepositoryMongoose");
const JuegoRepositoryMongoose = require("../../../Juego/Infraestructura/JuegoRepositoryMongoose");
const VersionRepositoryMongoose = require("../../../Juego/Infraestructura/VersionRepositoryMongoose");
const CatalogoRecursosJson = require("../../../Juego/Infraestructura/CatalogoRecursosJson");

const SolicitarGeneracion = require("../../Aplicacion/SolicitarGeneracion");
const ProcesarGeneracion = require("../../Aplicacion/ProcesarGeneracion");
const ReservarCupoGeneracion = require("../../Aplicacion/ReservarCupoGeneracion");
const LiberarReservaGeneracion = require("../../Aplicacion/LiberarReservaGeneracion");
const RegistrarConsumoGeneracion = require("../../Aplicacion/RegistrarConsumoGeneracion");
const ConciliarGeneraciones = require("../../Aplicacion/ConciliarGeneraciones");
const ListarGeneraciones = require("../../Aplicacion/ListarGeneraciones");
const ObtenerGeneracion = require("../../Aplicacion/ObtenerGeneracion");
const CancelarGeneracion = require("../../Aplicacion/CancelarGeneracion");
const ConsultarCuotas = require("../../Aplicacion/ConsultarCuotas");

// GENERADOR_FALSO_DEMORA_MS: espera simulada del generador falso. Vacía o sin definir = sin demora; un valor inválido no deja arrancar.
function leerDemoraFalsa(env) {
  const texto = env.GENERADOR_FALSO_DEMORA_MS;
  if (texto === undefined || texto.trim() === "") return 0;
  if (!/^\d+$/.test(texto.trim())) throw new Error("GENERADOR_FALSO_DEMORA_MS debe ser un entero de milisegundos, 0 o más");
  return Number(texto.trim());
}

function crearGenerador(env = process.env) {
  const proveedor = env.AI_PROVEEDOR || "falso";
  if (proveedor === "falso") return new GeneradorContenidoFalso({ demoraMs: leerDemoraFalsa(env) });
  if (proveedor === "gemini") {
    // Sin valores por defecto: el modelo y el tope de salida salen de la prueba del modelo (S4-06)
    const faltan = ["GEMINI_API_KEY", "GEMINI_MODELO", "AI_MAX_TOKENS_SALIDA"].filter((n) => !env[n] || !env[n].trim());
    if (faltan.length) throw new Error(`AI_PROVEEDOR=gemini requiere definir: ${faltan.join(", ")}`);
    const razonamiento = env.GEMINI_RAZONAMIENTO && env.GEMINI_RAZONAMIENTO.trim() ? Number(env.GEMINI_RAZONAMIENTO) : undefined;
    return new GeneradorContenidoIA({
      apiKey: env.GEMINI_API_KEY.trim(), modelo: env.GEMINI_MODELO.trim(), maxTokensSalida: Number(env.AI_MAX_TOKENS_SALIDA), presupuestoRazonamiento: razonamiento
    });
  }
  throw new Error(`AI_PROVEEDOR "${proveedor}" no está disponible: use "falso" o "gemini"`);
}

// La reserva antes de cada llamada es costoMaximoLlamada: si el tope de salida solo ya cuesta más, el consumo
// real podría superar lo reservado y rebasar el presupuesto sin aviso. Se comprueba al arrancar.
function verificarCostoMaximo(config, generador) {
  if (!config.habilitada || !Number.isInteger(generador.maxTokensSalida)) return;
  const costoSalida = config.costoDe({ tokensEntrada: 0, tokensSalida: generador.maxTokensSalida });
  if (costoSalida > config.costoMaximoLlamada) {
    throw new Error(`AI_COSTO_MAXIMO_LLAMADA (${config.costoMaximoLlamada}) no cubre ni los tokens de salida máximos (${costoSalida}); súbalo o baje AI_MAX_TOKENS_SALIDA`);
  }
}

// Arma los casos de uso con sus repositorios. Se exporta para que las pruebas usen el mismo cableado
// con otra configuración o con un generador de pruebas.
// filtroContenido (opcional) habilita la temática libre; registerGeneracionModule todavía no lo entrega (paso 7).
function componer({ config, generador, filtroContenido }) {
  const repo = new GeneracionRepositorySequelize();
  const cuotaRepo = new CuotaRepositorySequelize();
  const estudianteRepo = new EstudianteRepositorySequelize();
  const juegoRepo = new JuegoRepositoryMongoose();
  const versionRepo = new VersionRepositoryMongoose();

  const liberarReserva = new LiberarReservaGeneracion(repo, cuotaRepo);
  const conciliar = new ConciliarGeneraciones({ generacionRepository: repo, juegoRepository: juegoRepo, versionRepository: versionRepo, liberarReserva, config });
  const reservarCupo = new ReservarCupoGeneracion(repo, cuotaRepo, config);
  const procesarGeneracion = new ProcesarGeneracion({
    generacionRepository: repo, juegoRepository: juegoRepo, versionRepository: versionRepo, estudianteRepository: estudianteRepo,
    generador, catalogo: new CatalogoRecursosJson(), config,
    registrarConsumo: new RegistrarConsumoGeneracion(repo, cuotaRepo, config), liberarReserva
  });

  return {
    repo, cuotaRepo, juegoRepo, versionRepo, liberarReserva, conciliar, reservarCupo, procesarGeneracion,
    solicitar: new SolicitarGeneracion({
      generacionRepository: repo, cursoRepository: new CursoRepositorySequelize(), estudianteRepository: estudianteRepo,
      canalRepository: new CanalRepositoryMongoose(), config, procesarGeneracion, liberarReserva, conciliar, reservarCupo, filtroContenido
    }),
    listar: new ListarGeneraciones(repo, conciliar),
    obtener: new ObtenerGeneracion(repo, conciliar),
    cancelar: new CancelarGeneracion(repo, liberarReserva),
    consultarCuotas: new ConsultarCuotas(cuotaRepo, config)
  };
}

function registerGeneracionModule(app) {
  const config = leerConfiguracionGeneracion();
  const generador = crearGenerador();
  verificarCostoMaximo(config, generador);
  const casos = componer({ config, generador });

  const generacionController = new GeneracionController({
    solicitarGeneracion: casos.solicitar,
    listarGeneraciones: casos.listar,
    obtenerGeneracion: casos.obtener,
    cancelarGeneracion: casos.cancelar
  });
  const cuotaController = new CuotaController({ consultarCuotas: casos.consultarCuotas });

  app.use("/api/generaciones", GeneracionRoutes(generacionController));
  app.use("/api/cuotas", CuotaRoutes(cuotaController));
  // server.js la ejecuta al arrancar, cuando las dos bases ya están conectadas
  app.locals.conciliarGeneraciones = casos.conciliar;
}

module.exports = registerGeneracionModule;
module.exports.componer = componer;
module.exports.crearGenerador = crearGenerador;
module.exports.verificarCostoMaximo = verificarCostoMaximo;

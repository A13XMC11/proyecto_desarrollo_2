const ConfiguracionGeneracion = require("../Dominio/Entidades/ConfiguracionGeneracion");

const numero = (env, nombre) => (env[nombre] === undefined || env[nombre].trim() === "" ? undefined : Number(env[nombre]));

// Lee la configuración de generación del entorno. Apagada por defecto: para habilitarla (AI_ENABLED=true)
// hay que definir el tiempo límite y los valores económicos; si falta alguno el servidor no arranca.
function leerConfiguracionGeneracion(env = process.env) {
  return new ConfiguracionGeneracion({
    habilitada: env.AI_ENABLED === "true",
    // La temática libre se enciende aparte y solo con el valor exacto "true"
    libreHabilitada: env.GENERACION_LIBRE_HABILITADA === "true",
    // Desde el sprint 7 los 10 ejercicios están habilitados; PERMITIR_10_EJERCICIOS=false los apaga
    permitirDiez: env.PERMITIR_10_EJERCICIOS !== "false",
    maxDiarias: numero(env, "AI_MAX_DIARIAS") ?? 3,
    maxSimultaneas: numero(env, "AI_MAX_SIMULTANEAS") ?? 1,
    zonaHoraria: env.ZONA_HORARIA && env.ZONA_HORARIA.trim() ? env.ZONA_HORARIA.trim() : undefined,
    tiempoLimiteMs: numero(env, "AI_TIEMPO_LIMITE_MS"),
    margenConciliacionMs: numero(env, "AI_MARGEN_CONCILIACION_MS"),
    presupuestoMensual: numero(env, "AI_PRESUPUESTO_MENSUAL"),
    costoMaximoLlamada: numero(env, "AI_COSTO_MAXIMO_LLAMADA"),
    tarifaEntrada: numero(env, "AI_TARIFA_ENTRADA_MTOK"),
    tarifaSalida: numero(env, "AI_TARIFA_SALIDA_MTOK")
  });
}

module.exports = leerConfiguracionGeneracion;

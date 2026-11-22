#!/usr/bin/env node
// S4-06: mide latencia, consumo y tasa de contenido válido con llamadas REALES al proveedor.
// Cada llamada cuesta dinero, por eso exige --confirmo-costo y tiene un tope de llamadas.
//
//   node --env-file=.env scripts/medirGeneracion.js --confirmo-costo [--por-caso=2] [--max-llamadas=12]
//
// Variables: GEMINI_API_KEY, GEMINI_MODELO, AI_MAX_TOKENS_SALIDA y, para estimar el costo,
// AI_TARIFA_ENTRADA_MTOK y AI_TARIFA_SALIDA_MTOK. No guarda la clave ni la imprime.
// Pasa cada respuesta por la misma validación pedagógica que usa el servidor (ProcesarGeneracion).
const GeneradorContenidoIA = require("../src/lib/Generacion/Infraestructura/GeneradorContenidoIA");
const CatalogoRecursosJson = require("../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const VersionJuego = require("../src/lib/Juego/Dominio/Entidades/VersionJuego");
const { COMPATIBILIDAD, TEMATICAS } = require("../src/lib/Compartido/Dominio/ValoresPermitidos");

const CANTIDAD = 5;
const TIEMPO_LIMITE_MS = 60_000; // tope de seguridad solo para esta medición; el límite real sale de estos resultados

const TOPE_DURO_LLAMADAS = 30; // aunque se pida más, esta herramienta nunca hace más llamadas de pago que estas

const argumento = (nombre, defecto) => {
  const hallado = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  if (!hallado) return defecto;
  const valor = Number(hallado.split("=")[1]);
  if (!Number.isInteger(valor) || valor < 1) {
    console.error(`--${nombre} debe ser un entero positivo`);
    process.exit(1);
  }
  return valor;
};
// La clave solo puede ir a un servidor local de pruebas o al proveedor real, nunca a otro host
const urlBaseSegura = (url) => {
  if (!url) return undefined;
  const { hostname } = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(hostname)) {
    console.error("GEMINI_URL_BASE solo admite localhost o 127.0.0.1 (es para probar este script sin costo)");
    process.exit(1);
  }
  return url;
};
const percentil = (valores, p) => {
  if (!valores.length) return undefined;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
};
const numeroEnv = (nombre) => (process.env[nombre] && process.env[nombre].trim() ? Number(process.env[nombre]) : undefined);

function validar(solicitud, resultado, catalogo) {
  VersionJuego.rechazarCamposDesconocidos(resultado.ejercicios);
  new VersionJuego({
    juegoId: "medicion",
    configuracion: { habilidad: solicitud.habilidad, mecanica: solicitud.mecanica, tematica: solicitud.tematica, cantidadEjercicios: solicitud.cantidad },
    ejercicios: resultado.ejercicios
  }).validarContenido(catalogo);
}

async function medir(generador, solicitud, catalogo) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_LIMITE_MS);
  const inicio = performance.now();
  const fila = { habilidad: solicitud.habilidad, tematica: solicitud.tematica };
  try {
    const resultado = await generador.generar(solicitud, { signal: control.signal });
    fila.ms = Math.round(performance.now() - inicio);
    fila.tokensEntrada = resultado.uso.tokensEntrada;
    fila.tokensSalida = resultado.uso.tokensSalida;
    try {
      validar(solicitud, resultado, catalogo);
      fila.resultado = "valido";
    } catch (error) {
      fila.resultado = "contenido_invalido";
      fila.detalle = error.message;
    }
  } catch (error) {
    fila.ms = Math.round(performance.now() - inicio);
    fila.resultado = error.codigo || "error";
  } finally {
    clearTimeout(temporizador);
  }
  return fila;
}

async function main() {
  if (!process.argv.includes("--confirmo-costo")) {
    console.error("Esta medición hace llamadas reales con costo. Repite con --confirmo-costo cuando el presupuesto esté aprobado (S4-08).");
    process.exit(1);
  }
  const faltan = ["GEMINI_API_KEY", "GEMINI_MODELO", "AI_MAX_TOKENS_SALIDA"].filter((n) => !process.env[n]);
  if (faltan.length) {
    console.error(`Faltan variables de entorno: ${faltan.join(", ")}`);
    process.exit(1);
  }
  const porCaso = argumento("por-caso", 2);
  const maxLlamadas = Math.min(argumento("max-llamadas", 12), TOPE_DURO_LLAMADAS);
  const casos = Object.keys(COMPATIBILIDAD).flatMap((habilidad) => TEMATICAS.map((tematica) => ({ habilidad, tematica })));
  const total = Math.min(casos.length * porCaso, maxLlamadas);
  console.error(`Se harán ${total} llamadas reales a ${process.env.GEMINI_MODELO} (tope: ${maxLlamadas}).`);

  const catalogo = new CatalogoRecursosJson();
  const generador = new GeneradorContenidoIA({
    apiKey: process.env.GEMINI_API_KEY, modelo: process.env.GEMINI_MODELO, maxTokensSalida: Number(process.env.AI_MAX_TOKENS_SALIDA),
    ...(urlBaseSegura(process.env.GEMINI_URL_BASE) && { urlBase: process.env.GEMINI_URL_BASE }), // solo para probar el script con un servidor local
    ...(process.env.GEMINI_RAZONAMIENTO && { presupuestoRazonamiento: Number(process.env.GEMINI_RAZONAMIENTO) })
  });
  const filas = [];
  // En serie: una llamada simultánea por docente es la regla del producto y así la latencia no se contamina
  for (let i = 0; i < total; i++) {
    const { habilidad, tematica } = casos[i % casos.length];
    const solicitud = { habilidad, mecanica: COMPATIBILIDAD[habilidad], tematica, cantidad: CANTIDAD, recursos: catalogo.listar({ tematica }) };
    const fila = await medir(generador, solicitud, catalogo);
    filas.push(fila);
    console.error(`${i + 1}/${total} ${habilidad} / ${tematica}: ${fila.resultado} en ${fila.ms} ms`);
  }

  const tarifaEntrada = numeroEnv("AI_TARIFA_ENTRADA_MTOK");
  const tarifaSalida = numeroEnv("AI_TARIFA_SALIDA_MTOK");
  const conUso = filas.filter((f) => f.tokensEntrada !== undefined && f.tokensSalida !== undefined);
  const costo = (f) => (tarifaEntrada !== undefined && tarifaSalida !== undefined ? (f.tokensEntrada / 1e6) * tarifaEntrada + (f.tokensSalida / 1e6) * tarifaSalida : undefined);
  const costos = conUso.map(costo).filter((c) => c !== undefined);
  const validas = filas.filter((f) => f.resultado === "valido").length;
  // Un error rápido (429, 5xx) no es una latencia de generación: se mide solo lo que llegó a responder contenido
  const ms = filas.filter((f) => f.resultado === "valido" || f.resultado === "contenido_invalido").map((f) => f.ms);

  console.log(`# Medición de generación (${new Date().toISOString().slice(0, 10)})\n`);
  console.log(`Modelo: ${process.env.GEMINI_MODELO} · tope de salida: ${process.env.AI_MAX_TOKENS_SALIDA} tokens · ejercicios por actividad: ${CANTIDAD}\n`);
  console.log("| # | Habilidad | Temática | Resultado | ms | Tokens entrada | Tokens salida | Costo |");
  console.log("|---|---|---|---|---|---|---|---|");
  filas.forEach((f, i) => {
    const c = conUso.includes(f) ? costo(f) : undefined;
    console.log(`| ${i + 1} | ${f.habilidad} | ${f.tematica} | ${f.resultado} | ${f.ms} | ${f.tokensEntrada ?? "desconocido"} | ${f.tokensSalida ?? "desconocido"} | ${c === undefined ? "n/d" : c.toFixed(6)} |`);
  });
  console.log(`\n- Llamadas: ${filas.length} · contenido válido: ${validas} (${Math.round((100 * validas) / Math.max(1, filas.length))} %)`);
  console.log(ms.length
    ? `- Latencia (solo respuestas con contenido, ${ms.length}): mediana ${percentil(ms, 50)} ms · P95 ${percentil(ms, 95)} ms · máxima ${Math.max(...ms)} ms`
    : "- Latencia: ninguna llamada devolvió contenido.");
  const fallos = filas.filter((f) => !ms.length || (f.resultado !== "valido" && f.resultado !== "contenido_invalido"));
  if (ms.length && fallos.length) console.log(`- ${fallos.length} llamada(s) fallaron antes de devolver contenido: ${[...new Set(fallos.map((f) => f.resultado))].join(", ")}`);
  console.log(`- Tokens máximos observados: entrada ${Math.max(0, ...conUso.map((f) => f.tokensEntrada))} · salida ${Math.max(0, ...conUso.map((f) => f.tokensSalida))}`);
  if (costos.length) console.log(`- Costo por llamada: promedio ${(costos.reduce((a, b) => a + b, 0) / costos.length).toFixed(6)} · máximo ${Math.max(...costos).toFixed(6)} (misma moneda que las tarifas)`);
  else console.log("- Costo: no calculado (faltan tarifas o el proveedor no informó el uso). Contrastar con la facturación del proveedor.");
  const sinUso = filas.length - conUso.length;
  if (sinUso) console.log(`- ${sinUso} llamada(s) sin uso informado: se tratan como consumo desconocido, no como cero.`);
}

main().catch((error) => {
  console.error("La medición falló:", error.message);
  process.exit(1);
});

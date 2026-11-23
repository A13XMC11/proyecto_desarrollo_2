#!/usr/bin/env node
// S6-02: revisa la configuración y los secretos ANTES de entregar o publicar. No hace llamadas de red ni cambia nada.
//
//   Con las variables de entorno del despliegue cargadas:
//     node --env-file=.env.produccion scripts/revisarConfiguracion.js
//   Solo el repositorio (secretos en archivos versionados), sin mirar el entorno:
//     npm run revisar:configuracion -- --solo-repositorio
//
// Sale con código 1 si hay algo que impide publicar (✘). Los avisos (⚠) piden una decisión, no bloquean.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "../..");
const nivel = { ok: "✔", error: "✘", aviso: "⚠" };

// Patrones de credenciales que no deben estar en archivos versionados
const PATRONES_SECRETOS = [
  ["clave de API de Google", "AIza[0-9A-Za-z_\\-]{35}"],
  ["clave secreta tipo sk-", "sk-[A-Za-z0-9_\\-]{32,}"],
  ["URL de base de datos con contraseña", "(postgres(ql)?|mongodb(\\+srv)?)://[^:@/[:space:]]+:[^@/[:space:]]{3,}@"],
  ["clave privada", "-----BEGIN [A-Z ]*PRIVATE KEY-----"]
];

function revisarEntorno(env) {
  const r = [];
  const registrar = (n, texto, detalle = "") => r.push({ nivel: n, texto, detalle });
  const vacio = (v) => v === undefined || String(v).trim() === "";

  env.NODE_ENV === "production"
    ? registrar("ok", "NODE_ENV=production")
    : registrar("error", "NODE_ENV no es production", "sin esto la cookie de sesión no es Secure y no se confía en el proxy HTTPS");

  if (vacio(env.SESSION_SECRET)) registrar("error", "Falta SESSION_SECRET", "con NODE_ENV=production el servidor no arranca sin él");
  else if (env.SESSION_SECRET.split(",").some((s) => s.trim().length < 32)) registrar("error", "SESSION_SECRET es demasiado corto", "use al menos 32 caracteres aleatorios (48 bytes en hexadecimal recomendados)");
  else registrar("ok", "SESSION_SECRET definido y de longitud suficiente");

  for (const [nombre, valor] of [["SQL_URL", env.SQL_URL], ["MONGO_URI", env.MONGO_URI]]) {
    if (vacio(valor)) { registrar("error", `Falta ${nombre}`, "sin él se usa la base de desarrollo local"); continue; }
    const base = valor.split("?")[0].split("/").pop();
    if (/test/i.test(base)) registrar("error", `${nombre} apunta a una base de pruebas («${base}»)`);
    else if (/(^|\/\/[^/]*@?)(127\.0\.0\.1|localhost)/.test(valor)) registrar("aviso", `${nombre} apunta a esta misma máquina`, "¿es el entorno previsto?");
    else registrar("ok", `${nombre} definido y no es de pruebas ni local`);
  }

  env.SQL_SYNC_ALTER === "false"
    ? registrar("ok", "SQL_SYNC_ALTER=false (no altera tablas existentes)")
    : registrar("error", "SQL_SYNC_ALTER no es false", "en producción el servidor modificaría tablas al arrancar");

  if (!vacio(env.APP_ORIGIN)) {
    for (const origen of env.APP_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)) {
      try {
        const u = new URL(origen);
        u.protocol === "https:" ? registrar("ok", `APP_ORIGIN ${origen} es HTTPS`) : registrar("error", `APP_ORIGIN ${origen} no es HTTPS`);
      } catch {
        registrar("error", `APP_ORIGIN contiene un valor que no es una URL: ${origen}`);
      }
    }
  } else {
    registrar("ok", "APP_ORIGIN vacío (cliente y API en el mismo origen; CORS cerrado)");
  }

  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: env.ZONA_HORARIA || "America/Guayaquil" });
    registrar("ok", `Zona horaria válida (${env.ZONA_HORARIA || "America/Guayaquil por defecto"})`);
  } catch {
    registrar("error", `ZONA_HORARIA inválida: ${env.ZONA_HORARIA}`);
  }

  // Generación con IA: la misma validación que hace el servidor al arrancar
  try {
    const leerConfiguracionGeneracion = require("../src/lib/Generacion/Infraestructura/leerConfiguracionGeneracion");
    const { crearGenerador, verificarCostoMaximo } = require("../src/lib/Generacion/Infraestructura/http");
    const configuracion = leerConfiguracionGeneracion(env);
    if (!configuracion.habilitada) {
      registrar("ok", "Generación con IA apagada (AI_ENABLED≠true): la biblioteca y el juego funcionan igual");
    } else {
      const generador = crearGenerador(env);
      verificarCostoMaximo(configuracion, generador);
      registrar("aviso", "Generación con IA HABILITADA", "debe constar la autorización y el presupuesto (docs/generacion-ia.md §8); con proveedor real cada solicitud cuesta");
      if (env.AI_PROVEEDOR === "gemini") registrar("ok", "Proveedor gemini configurado con clave, modelo y tope de salida; coste máximo coherente");
      else registrar("ok", "Generador falso (sin proveedor ni costo)");
    }
  } catch (error) {
    registrar("error", "La configuración de generación con IA no es válida", error.message);
  }

  // Temática libre: interruptor propio, apagado por defecto. Solo el valor exacto "true" la enciende (como el servidor).
  const libre = env.GENERACION_LIBRE_HABILITADA;
  if (libre === "true") {
    if (env.AI_ENABLED !== "true") {
      registrar("aviso", "Configuración incoherente: GENERACION_LIBRE_HABILITADA=true con AI_ENABLED apagado",
        "no tendrá efecto: con la IA apagada toda generación responde GENERACION_DESHABILITADA; encienda AI_ENABLED o apague el interruptor");
    } else {
      registrar("aviso", "Temática libre HABILITADA",
        "amplía el SRS (RNF-011, §2.5 y §5.4) y debe validarse con el docente de la asignatura (C8); el filtro de contenido es una defensa parcial (C6) y cada solicitud cuesta más que una de catálogo (docs/generacion-ia.md)");
    }
  } else {
    if (!vacio(libre) && libre !== "false") {
      registrar("aviso", "GENERACION_LIBRE_HABILITADA tiene un valor no reconocido", "solo el valor exacto true la enciende; cualquier otro la deja apagada. Use true o false");
    }
    registrar("ok", "Temática libre apagada (GENERACION_LIBRE_HABILITADA≠true)");
  }

  return r;
}

function revisarRepositorio(raiz = RAIZ) {
  const r = [];
  const git = (...args) => execFileSync("git", ["-C", raiz, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  try {
    const versionados = git("ls-files").split("\n").filter(Boolean);
    const envs = versionados.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".env.example"));
    envs.length
      ? r.push({ nivel: "error", texto: `Hay archivos .env versionados: ${envs.join(", ")}`, detalle: "sáquenlos de Git y rote cualquier secreto que contengan" })
      : r.push({ nivel: "ok", texto: "Ningún archivo .env está versionado (solo .env.example)" });

    for (const [nombre, patron] of PATRONES_SECRETOS) {
      let salida = "";
      try {
        // :(exclude) deja fuera las plantillas y la documentación, que usan valores de ejemplo
        // -e: un patrón que empieza por «-» (como una clave privada) no debe leerse como opción
        salida = git("grep", "-nIE", "-e", patron, "--", ".", ":(exclude)*.env.example", ":(exclude)*.md", ":(exclude)package-lock.json");
      } catch {
        salida = ""; // git grep sale con 1 si no hay coincidencias
      }
      salida.trim()
        ? r.push({ nivel: "error", texto: `Posible ${nombre} en archivos versionados`, detalle: salida.trim().split("\n").slice(0, 3).map((l) => l.replace(/(:\/\/[^:]+:)[^@]+@/, "$1***@").slice(0, 120)).join(" | ") })
        : r.push({ nivel: "ok", texto: `Sin ${nombre} en archivos versionados` });
    }
  } catch {
    r.push({ nivel: "aviso", texto: "No se pudo revisar el repositorio (¿es un clon de Git con git instalado?)" });
  }
  return r;
}

function imprimir(titulo, resultados) {
  console.log(`\n${titulo}`);
  for (const x of resultados) console.log(`${nivel[x.nivel]} ${x.texto}${x.detalle ? `\n    ${x.detalle}` : ""}`);
}

module.exports = { revisarEntorno, revisarRepositorio };

if (require.main === module) {
  const soloRepo = process.argv.includes("--solo-repositorio");
  const todos = [];
  if (!soloRepo) {
    const entorno = revisarEntorno(process.env);
    imprimir("Entorno del despliegue", entorno);
    todos.push(...entorno);
  }
  const repo = revisarRepositorio();
  imprimir("Repositorio", repo);
  todos.push(...repo);
  const errores = todos.filter((x) => x.nivel === "error").length;
  const avisos = todos.filter((x) => x.nivel === "aviso").length;
  console.log(`\n${todos.length - errores - avisos} correctas, ${errores} con error, ${avisos} aviso(s).`);
  process.exit(errores ? 1 : 0);
}

#!/usr/bin/env node
// S5-08: mide rendimiento y capacidad con un escenario documentado y datos FICTICIOS. Solo lectura de resultados:
// no inventa cifras; imprime lo observado en Markdown para pegarlo en el informe (docs/informe-rendimiento.md).
//
//   npm run medir:rendimiento -- [--docentes=3] [--estudiantes=30] [--juegos=6] [--repeticiones=100] [--concurrencia=30]
//
// Modo local (por defecto): levanta la app en un puerto libre contra las bases de PRUEBAS (SQL_URL_TEST y
// MONGO_URI_TEST, cuyo nombre debe contener "test"), las VACÍA, siembra datos y mide. Nunca toca otras bases.
// Modo remoto de solo lectura (versión publicada, S5-06):
//   RENDIMIENTO_CORREO=... RENDIMIENTO_CONTRASENA=... npm run medir:rendimiento -- --url=https://mi-sitio
// En modo remoto no siembra ni crea partidas: mide biblioteca, resultados e inicio de una cuenta existente.
const os = require("node:os");

const argumento = (nombre, defecto) => {
  const hallado = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  if (!hallado) return defecto;
  const valor = hallado.split("=").slice(1).join("=");
  if (typeof defecto === "number") {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 1) {
      console.error(`--${nombre} debe ser un entero positivo`);
      process.exit(1);
    }
    return numero;
  }
  return valor;
};

const CONFIG = {
  docentes: argumento("docentes", 3),
  estudiantes: argumento("estudiantes", 30),
  juegos: argumento("juegos", 6),
  repeticiones: argumento("repeticiones", 100),
  concurrencia: argumento("concurrencia", 30),
  url: argumento("url", "")
};
if (CONFIG.estudiantes > 99) {
  console.error("--estudiantes admite hasta 99 por curso (los códigos de lista son A01 a A99)");
  process.exit(1);
}
const REMOTO = Boolean(CONFIG.url);

// ---------- Estadística ----------
const percentil = (valores, p) => {
  if (!valores.length) return undefined;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
};
const redondear = (n) => (n === undefined ? "n/d" : n.toFixed(1));
const resumen = (muestras) => {
  const ms = muestras.filter((m) => m.ok).map((m) => m.ms);
  return {
    n: muestras.length,
    errores: muestras.filter((m) => !m.ok).length,
    p50: percentil(ms, 50), p95: percentil(ms, 95), max: ms.length ? Math.max(...ms) : undefined
  };
};
const fila = (nombre, r) => `| ${nombre} | ${r.n} | ${r.errores} | ${redondear(r.p50)} | ${redondear(r.p95)} | ${redondear(r.max)} |`;
const CABECERA_TABLA = "| Operación | Peticiones | Errores | P50 (ms) | P95 (ms) | Máx. (ms) |\n|---|---|---|---|---|---|";

// Ejecuta tareas con a lo sumo `limite` en vuelo a la vez
async function enParalelo(tareas, limite) {
  const resultados = new Array(tareas.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(limite, tareas.length) }, async () => {
    while (siguiente < tareas.length) {
      const indice = siguiente++;
      resultados[indice] = await tareas[indice]();
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

// ---------- Cliente HTTP con cookie de sesión y CSRF (como un navegador) ----------
let base;
async function pedir(sesion, ruta, { metodo = "GET", cuerpo } = {}) {
  const inicio = performance.now();
  let respuesta;
  try {
    respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: {
        "content-type": "application/json",
        ...(sesion && { cookie: sesion.cookie, "x-csrf-token": sesion.csrf })
      },
      body: cuerpo && JSON.stringify(cuerpo)
    });
  } catch (error) {
    return { ok: false, status: 0, ms: performance.now() - inicio, cuerpo: undefined };
  }
  const texto = await respuesta.text();
  const ms = performance.now() - inicio;
  let datos;
  try { datos = texto ? JSON.parse(texto) : undefined; } catch { datos = undefined; }
  const cookie = respuesta.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("letritas.sid="));
  const csrf = respuesta.headers.get("x-csrf-token");
  return { ok: respuesta.ok, status: respuesta.status, ms, cuerpo: datos, cookie, csrf };
}
const exigir = (r, que) => {
  if (!r.ok) throw new Error(`${que} falló con el estado ${r.status}: ${JSON.stringify(r.cuerpo)}`);
  return r;
};

// ---------- Datos ficticios ----------
const ejercicio = (n) => {
  const vocal = n === 2 ? "o" : "a";
  return {
    id: `e${n}`, consigna: `¿Con qué vocal empieza esta palabra? (${n})`, pista: "Piensa en el sonido",
    recursoId: n === 2 ? "oso" : "abeja",
    opciones: [vocal, "e", "i"].map((t) => ({ id: t, texto: t })), respuestaCorrectaId: vocal
  };
};
const EJERCICIOS = Array.from({ length: 5 }, (_, i) => ejercicio(i + 1));
const correcta = (n) => (n === 2 ? "o" : "a");

async function crearJuegoAprobado(sesion, cursoId, titulo) {
  const juego = exigir(await pedir(sesion, "/api/juegos", { metodo: "POST", cuerpo: { cursoId, titulo, habilidad: "vocales" } }), "crear juego").cuerpo.id;
  const ruta = `/api/juegos/${juego}/versiones`;
  const version = exigir(await pedir(sesion, ruta, { metodo: "POST", cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: EJERCICIOS } }), "crear versión").cuerpo.id;
  exigir(await pedir(sesion, `${ruta}/${version}/aprobar`, { metodo: "POST" }), "aprobar versión");
  return juego;
}

// Una partida completa: iniciar y responder los 5 ejercicios. Devuelve las muestras de latencia de cada paso.
async function jugarPartida(sesion, estudianteId, juegoId, tag) {
  const muestras = { iniciar: [], intento: [] };
  const inicio = await pedir(sesion, "/api/partidas", { metodo: "POST", cuerpo: { estudianteId, juegoId } });
  muestras.iniciar.push(inicio);
  if (!inicio.ok) return muestras;
  const id = inicio.cuerpo.id;
  for (let n = 1; n <= 5; n++) {
    // Un tercio de los ejercicios se falla una vez antes de acertar, como en un aula real
    if (n % 3 === 0) {
      muestras.intento.push(await pedir(sesion, `/api/partidas/${id}/intentos`, { metodo: "POST", cuerpo: { ejercicioId: `e${n}`, eleccion: "i", operacionId: `${tag}-f${n}` } }));
    }
    muestras.intento.push(await pedir(sesion, `/api/partidas/${id}/intentos`, { metodo: "POST", cuerpo: { ejercicioId: `e${n}`, eleccion: correcta(n), operacionId: `${tag}-a${n}` } }));
  }
  return muestras;
}

async function sembrarDocente(indice) {
  const registro = exigir(await pedir(null, "/api/docentes", {
    metodo: "POST", cuerpo: { nombre: `Docente Ficticio ${indice + 1}`, correo: `rendimiento${Date.now()}${indice}@escuela.ec`, contrasena: "clave12345" }
  }), "registrar docente");
  const sesion = { cookie: registro.cookie, csrf: registro.csrf, id: registro.cuerpo.id };
  const curso = exigir(await pedir(sesion, "/api/cursos", { metodo: "POST", cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } }), "crear curso").cuerpo.id;
  const estudiantes = [];
  for (let e = 1; e <= CONFIG.estudiantes; e++) {
    estudiantes.push(exigir(await pedir(sesion, "/api/estudiantes", {
      metodo: "POST", cuerpo: { cursoId: curso, codigoLista: `A${String(e).padStart(2, "0")}`, franjaEdad: 6, avatarId: "gato" }
    }), "crear estudiante").cuerpo.id);
  }
  const juegos = [];
  for (let j = 1; j <= CONFIG.juegos; j++) juegos.push(await crearJuegoAprobado(sesion, curso, `Las vocales ${j}`));
  // Cada estudiante juega cada juego una vez, de a 10 a la vez (la siembra no se mide)
  const tareas = estudiantes.flatMap((est, e) => juegos.map((j, k) => () => jugarPartida(sesion, est, j, `s${indice}-${e}-${k}`)));
  await enParalelo(tareas, 10);
  return { sesion, curso, estudiantes, juegos };
}

// ---------- Índices ----------
// Recorre el plan de ejecución y devuelve las etapas que contiene
const etapasDe = (plan, acumulado = []) => {
  if (!plan || typeof plan !== "object") return acumulado;
  if (plan.stage) acumulado.push(plan.stage);
  for (const hijo of [plan.inputStage, ...(plan.inputStages || []), plan.queryPlan, plan.winningPlan]) etapasDe(hijo, acumulado);
  return acumulado;
};
async function comprobarIndices(docenteId, cursoId) {
  const mongoose = require("mongoose");
  const Juego = mongoose.model("Juego");
  const Sesion = mongoose.model("SesionJuego");
  const casos = [
    ["Biblioteca (docente, no archivadas, orden por fecha)", () => Juego.find({ docenteId, estado: { $ne: "archivado" } }).sort({ actualizadoEn: -1, _id: -1 }).limit(20).lean().explain("executionStats")],
    ["Biblioteca filtrada por curso", () => Juego.find({ docenteId, cursoId, estado: { $ne: "archivado" } }).sort({ actualizadoEn: -1, _id: -1 }).limit(20).lean().explain("executionStats")],
    ["Resultados por curso (docente, curso, orden por fecha)", () => Sesion.aggregate([{ $match: { docenteId, cursoId } }, { $sort: { creadoEn: -1, _id: -1 } }, { $limit: 2000 }]).explain("executionStats")],
    ["Inicio: partidas en curso", () => Sesion.find({ docenteId, estado: "en_curso" }).sort({ creadoEn: -1, _id: -1 }).limit(5).lean().explain("executionStats")],
    ["Inicio: conteo de terminadas en la semana", () => Sesion.find({ docenteId, estado: "finalizada", creadoEn: { $gte: new Date(Date.now() - 7 * 864e5) } }).lean().explain("executionStats")]
  ];
  const filas = [];
  for (const [nombre, consulta] of casos) {
    const explicacion = await consulta();
    const stats = explicacion.executionStats || explicacion.stages?.[0]?.$cursor?.executionStats;
    const plan = explicacion.queryPlanner || explicacion.stages?.[0]?.$cursor?.queryPlanner;
    const etapas = etapasDe(plan && plan.winningPlan);
    const usaIndice = etapas.includes("IXSCAN");
    const coleccion = etapas.includes("COLLSCAN");
    filas.push(`| ${nombre} | ${usaIndice ? "sí" : "NO"} | ${coleccion ? "SÍ" : "no"} | ${stats ? stats.totalDocsExamined : "n/d"} | ${stats ? stats.nReturned : "n/d"} |`);
  }
  return `| Consulta | Usa índice | Recorre toda la colección | Documentos examinados | Devueltos |\n|---|---|---|---|---|\n${filas.join("\n")}`;
}

// ---------- Arranque ----------
const nombreDeBase = (url) => url.split("?")[0].split("/").pop();
function validarBasesDePruebas() {
  const { SQL_URL_TEST: sql, MONGO_URI_TEST: mongo } = process.env;
  if (!sql || !mongo) {
    console.error("Definan SQL_URL_TEST y MONGO_URI_TEST: esta herramienta siembra y vacía esas bases.");
    process.exit(1);
  }
  for (const [nombre, url] of [["SQL_URL_TEST", sql], ["MONGO_URI_TEST", mongo]]) {
    if (!/test/i.test(nombreDeBase(url))) {
      console.error(`${nombre} debe apuntar a una base cuyo nombre contenga "test". Se negó a continuar.`);
      process.exit(1);
    }
  }
  // Antes de cargar cualquier modelo: Sequelize toma SQL_URL al requerirlos
  process.env.SQL_URL = sql;
  process.env.MONGO_URI = mongo;
}

async function iniciarLocal() {
  validarBasesDePruebas();
  const mongoose = require("mongoose");
  const { connection: connectMongo, disconnect: disconnectMongo } = require("../src/Infraestructura/database/Mongo");
  const { connection: connectSql, disconnect: disconnectSql, obtenerSequelize } = require("../src/Infraestructura/database/Sequelize");
  const { crearAsegurarCanales } = require("../src/lib/Canal/Infraestructura/http");
  await obtenerSequelize().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await connectSql({ force: true });
  const temporal = mongoose.createConnection(process.env.MONGO_URI);
  await temporal.asPromise();
  await temporal.dropDatabase();
  await temporal.close();
  await connectMongo();
  await crearAsegurarCanales().ejecutar();
  const servidor = require("../src/app")().listen(0);
  await new Promise((resolver) => servidor.once("listening", resolver));
  base = `http://127.0.0.1:${servidor.address().port}`;
  return async () => {
    servidor.close();
    await disconnectMongo();
    await disconnectSql();
  };
}

async function medirLectura(nombre, sesiones, rutaDe, resultado) {
  // Secuencial: latencia sin competencia
  const secuenciales = [];
  for (let i = 0; i < CONFIG.repeticiones; i++) secuenciales.push(await pedir(sesiones[i % sesiones.length], rutaDe(sesiones[i % sesiones.length])));
  // Concurrente: `concurrencia` peticiones a la vez
  const tareas = Array.from({ length: CONFIG.concurrencia * 3 }, (_, i) => () => pedir(sesiones[i % sesiones.length], rutaDe(sesiones[i % sesiones.length])));
  const concurrentes = await enParalelo(tareas, CONFIG.concurrencia);
  resultado.push({ nombre, secuencial: resumen(secuenciales), concurrente: resumen(concurrentes) });
}

async function main() {
  const cerrar = REMOTO ? async () => {} : await iniciarLocal();
  if (REMOTO) base = CONFIG.url.replace(/\/+$/, "");
  const salida = [];
  try {
    let docentes;
    if (REMOTO) {
      const { RENDIMIENTO_CORREO: correo, RENDIMIENTO_CONTRASENA: contrasena } = process.env;
      if (!correo || !contrasena) throw new Error("En modo remoto definan RENDIMIENTO_CORREO y RENDIMIENTO_CONTRASENA (una cuenta de prueba)");
      const entrada = exigir(await pedir(null, "/api/docentes/sesion", { metodo: "POST", cuerpo: { correo, contrasena } }), "iniciar sesión");
      docentes = [{ sesion: { cookie: entrada.cookie, csrf: entrada.csrf, id: entrada.cuerpo.id }, curso: undefined }];
    } else {
      console.error(`Sembrando ${CONFIG.docentes} docente(s) × ${CONFIG.estudiantes} estudiantes × ${CONFIG.juegos} juegos…`);
      docentes = [];
      for (let d = 0; d < CONFIG.docentes; d++) docentes.push(await sembrarDocente(d));
    }
    const sesiones = docentes.map((d) => d.sesion);

    console.error("Midiendo lecturas…");
    const lecturas = [];
    await medirLectura("Biblioteca (GET /api/juegos)", sesiones, () => "/api/juegos", lecturas);
    await medirLectura("Biblioteca filtrada (habilidad + texto)", sesiones, () => "/api/juegos?habilidad=vocales&texto=vocales", lecturas);
    await medirLectura("Inicio (GET /api/inicio)", sesiones, () => "/api/inicio", lecturas);
    await medirLectura("Resultados del docente (GET /api/resultados)", sesiones, () => "/api/resultados", lecturas);
    if (!REMOTO) {
      const cursoDe = new Map(docentes.map((d) => [d.sesion, d.curso]));
      await medirLectura("Resultados de un curso", sesiones, (s) => `/api/resultados?cursoId=${cursoDe.get(s)}`, lecturas);
    }

    let aula;
    let indices;
    let datos = "";
    if (!REMOTO) {
      console.error(`Simulando un aula con ${CONFIG.estudiantes} estudiantes jugando a la vez…`);
      const d = docentes[0];
      const juegoAula = await crearJuegoAprobado(d.sesion, d.curso, "Aula simultánea");
      const partidas = await enParalelo(d.estudiantes.map((est, i) => () => jugarPartida(d.sesion, est, juegoAula, `aula-${i}`)), d.estudiantes.length);
      aula = { iniciar: resumen(partidas.flatMap((p) => p.iniciar)), intento: resumen(partidas.flatMap((p) => p.intento)) };
      console.error("Comprobando índices…");
      indices = await comprobarIndices(d.sesion.id, d.curso);
      const hechas = (await pedir(d.sesion, "/api/resultados")).cuerpo;
      datos = `${docentes.length} docente(s), ${CONFIG.estudiantes} estudiantes por curso, ${CONFIG.juegos} juegos por docente; ${hechas.resumen.partidas} partidas finalizadas visibles en la cuenta 1 (el resultado se acota al máximo del servidor).`;
    }

    salida.push(`# Medición de rendimiento (${new Date().toISOString().slice(0, 10)})\n`);
    salida.push("## Escenario\n");
    salida.push(`- Modo: ${REMOTO ? `remoto, solo lectura, ${CONFIG.url}` : "local, bases de pruebas vaciadas y sembradas con datos ficticios"}.`);
    salida.push(`- Máquina: ${os.cpus().length} núcleos (${os.cpus()[0].model.trim()}), ${(os.totalmem() / 2 ** 30).toFixed(0)} GB de RAM, Node ${process.version}, ${os.platform()} ${os.arch()}.`);
    if (!REMOTO) salida.push(`- Datos: ${datos}`);
    salida.push(`- Lecturas: ${CONFIG.repeticiones} peticiones en serie y ${CONFIG.concurrencia * 3} con ${CONFIG.concurrencia} en vuelo a la vez, repartidas entre las cuentas.`);
    if (!REMOTO) salida.push(`- Aula: ${CONFIG.estudiantes} estudiantes de una cuenta inician y completan una partida de 5 ejercicios a la vez (un tercio falla una vez).`);
    salida.push("- La latencia incluye HTTP local y la base; no incluye red de internet ni el navegador.\n");
    salida.push("## Lecturas en serie (sin competencia)\n");
    salida.push(CABECERA_TABLA);
    lecturas.forEach((l) => salida.push(fila(l.nombre, l.secuencial)));
    salida.push(`\n## Lecturas con ${CONFIG.concurrencia} peticiones simultáneas\n`);
    salida.push(CABECERA_TABLA);
    lecturas.forEach((l) => salida.push(fila(l.nombre, l.concurrente)));
    if (aula) {
      salida.push(`\n## Aula: ${CONFIG.estudiantes} estudiantes a la vez\n`);
      salida.push(CABECERA_TABLA);
      salida.push(fila("Iniciar partida", aula.iniciar));
      salida.push(fila("Registrar intento", aula.intento));
      salida.push("\n## Uso de índices (explain de MongoDB)\n");
      salida.push(indices);
    }
  } finally {
    await cerrar();
  }
  console.log(salida.join("\n"));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("La medición falló:", error.message);
  process.exit(1);
});

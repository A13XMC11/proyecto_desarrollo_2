#!/usr/bin/env node
// S6-02: demuestra UNA VEZ que los datos se pueden respaldar y restaurar. Criterio del plan: «respaldo y restauración
// probados». Corre sobre las bases de PRUEBAS (SQL_URL_TEST y MONGO_URI_TEST, nombre con «test»; las vacía):
//   1. Siembra la demostración y guarda lo que la API devuelve.
//   2. Respalda PostgreSQL con pg_dump (formato personalizado) y MongoDB con un volcado lógico en EJSON.
//   3. Destruye las dos bases.
//   4. Restaura con pg_restore y con el volcado de MongoDB (documentos e índices).
//   5. Arranca el servidor REAL sobre lo restaurado y comprueba que todo coincide: filas, índices, la sesión de antes,
//      el inicio de sesión (la contraseña), lo que la API devuelve y que una partida a medias se puede continuar.
//
//   npm run probar:respaldo
//   Si pg_dump no coincide con la versión del servidor PostgreSQL (pg_dump lo rechaza), indiquen el directorio de las
//   herramientas correctas: PG_BIN=/Library/PostgreSQL/18/bin npm run probar:respaldo
//
// Nota: mongodump no está instalado en este equipo, por eso MongoDB se respalda con un volcado lógico propio.
// Demuestra el procedimiento y que los índices vuelven; en un alojamiento real se usan los respaldos del proveedor
// o mongodump (ver docs/recuperacion.md).
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const ejecutar = promisify(execFile);

const nombreDeBase = (url) => url.split("?")[0].split("/").pop();
const { SQL_URL_TEST: SQL, MONGO_URI_TEST: MONGO } = process.env;
if (!SQL || !MONGO || !/test/i.test(nombreDeBase(SQL)) || !/test/i.test(nombreDeBase(MONGO))) {
  console.error('Definan SQL_URL_TEST y MONGO_URI_TEST con bases cuyo nombre contenga "test": esta prueba las VACÍA.');
  process.exit(1);
}
// Antes de cargar cualquier modelo
process.env.SQL_URL = SQL;
process.env.MONGO_URI = MONGO;
process.env.SESSION_SECRET = "secreto-de-respaldo-solo-pruebas";
process.env.AI_ENABLED = "false";

const mongoose = require("mongoose");
const { Client } = require("pg");
const { EJSON } = mongoose.mongo.BSON;
const { MongoClient } = mongoose.mongo;
const { crearNavegador } = require("./clienteApi");
const { sembrarDemo } = require("./sembrarDemo");
const { ejerciciosDe, eleccionCorrecta } = require("./contenidoFicticio");

const informe = [];
const paso = (titulo, detalle = "") => {
  informe.push(`- **${titulo}**${detalle ? `: ${detalle}` : ""}`);
  console.error(`✔ ${titulo}${detalle ? ` (${detalle})` : ""}`);
};
const kb = (ruta) => `${(fs.statSync(ruta).size / 1024).toFixed(0)} kB`;
const ms = (inicio) => `${(performance.now() - inicio).toFixed(0)} ms`;

const binarioPg = (nombre) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, nombre) : nombre);

// pg_dump y pg_restore reciben la clave por entorno, no por argumentos (que otros procesos pueden ver)
function argumentosPg(url) {
  const u = new URL(url);
  return {
    args: ["-h", u.hostname, "-p", u.port || "5432", "-U", decodeURIComponent(u.username), "-d", u.pathname.slice(1)],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) }
  };
}

async function huella() {
  const cliente = new Client({ connectionString: SQL });
  await cliente.connect();
  const sql = { tablas: {}, indices: 0 };
  try {
    const { rows } = await cliente.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1");
    for (const { tablename } of rows) sql.tablas[tablename] = Number((await cliente.query(`SELECT count(*) FROM "${tablename}"`)).rows[0].count);
    sql.indices = (await cliente.query("SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname = 'public'")).rows[0].n;
  } finally {
    await cliente.end();
  }
  const mongo = { colecciones: {}, indices: {} };
  const cm = new MongoClient(MONGO);
  await cm.connect();
  try {
    const db = cm.db();
    for (const { name } of await db.listCollections().toArray()) {
      mongo.colecciones[name] = await db.collection(name).countDocuments();
      mongo.indices[name] = (await db.collection(name).indexes()).map((i) => i.name).sort();
    }
  } finally {
    await cm.close();
  }
  return { sql, mongo };
}

async function volcarMongo(directorio) {
  const cm = new MongoClient(MONGO);
  await cm.connect();
  try {
    const db = cm.db();
    const colecciones = [];
    for (const { name } of await db.listCollections().toArray()) {
      const docs = await db.collection(name).find().toArray();
      const indices = await db.collection(name).indexes();
      fs.writeFileSync(path.join(directorio, `${name}.ejson`), EJSON.stringify({ docs, indices }, { relaxed: false }));
      colecciones.push(name);
    }
    return colecciones;
  } finally {
    await cm.close();
  }
}

async function restaurarMongo(directorio, colecciones) {
  const cm = new MongoClient(MONGO);
  await cm.connect();
  try {
    const db = cm.db();
    for (const nombre of colecciones) {
      const { docs, indices } = EJSON.parse(fs.readFileSync(path.join(directorio, `${nombre}.ejson`), "utf8"), { relaxed: false });
      await db.createCollection(nombre);
      if (docs.length) await db.collection(nombre).insertMany(docs);
      for (const { key, name, v, ns, ...opciones } of indices) {
        if (name !== "_id_") await db.collection(nombre).createIndex(key, { name, ...opciones });
      }
    }
  } finally {
    await cm.close();
  }
}

async function destruirTodo() {
  const cliente = new Client({ connectionString: SQL });
  await cliente.connect();
  try {
    await cliente.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    assert.equal((await cliente.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'")).rows[0].n, 0);
  } finally {
    await cliente.end();
  }
  const cm = new MongoClient(MONGO);
  await cm.connect();
  try {
    await cm.db().dropDatabase();
    assert.equal((await cm.db().listCollections().toArray()).length, 0);
  } finally {
    await cm.close();
  }
}

// Servidor REAL como proceso aparte, sobre lo restaurado y sin permiso para alterar tablas
async function arrancarServidor(puerto) {
  const proceso = spawn(process.execPath, ["index.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(puerto), SQL_SYNC_ALTER: "false", NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let salida = "";
  await new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error(`el servidor no arrancó:\n${salida}`)), 20000);
    const leer = (d) => { salida += d; if (salida.includes("corriendo correctamente")) { clearTimeout(limite); resolver(); } };
    proceso.stdout.on("data", leer);
    proceso.stderr.on("data", (d) => { salida += d; });
    proceso.once("exit", (c) => { clearTimeout(limite); rechazar(new Error(`el servidor salió (${c}):\n${salida}`)); });
  });
  return async () => { proceso.removeAllListeners("exit"); proceso.kill("SIGTERM"); await new Promise((r) => proceso.once("exit", r)); };
}

async function main() {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), "respaldo-"));
  try {
    // 1) Datos de partida, creados por la API del servidor real
    const { connection: connectSql, disconnect: disconnectSql, obtenerSequelize } = require("../src/Infraestructura/database/Sequelize");
    const { connection: connectMongo, disconnect: disconnectMongo } = require("../src/Infraestructura/database/Mongo");
    const { crearAsegurarCanales } = require("../src/lib/Canal/Infraestructura/http");
    await obtenerSequelize().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await connectSql({ force: true });
    const temporal = mongoose.createConnection(MONGO);
    await temporal.asPromise();
    await temporal.dropDatabase();
    await temporal.close();
    await connectMongo();
    await crearAsegurarCanales().ejecutar();
    const http = require("../src/app")().listen(0);
    await new Promise((r) => http.once("listening", r));
    const nav = crearNavegador(`http://127.0.0.1:${http.address().port}`);
    const demo = await sembrarDemo(nav);
    const antes = {};
    for (const ruta of ["/api/cursos", "/api/juegos", "/api/resultados", "/api/inicio"]) antes[ruta] = (await nav.llamar(ruta)).cuerpo;
    const sesionAnterior = { ...nav.estado };
    http.closeAllConnections();
    await new Promise((r) => http.close(r));
    await disconnectMongo();
    await disconnectSql();
    paso("Datos de partida", `demostración sembrada por la API: ${demo.partidasTerminadas} partidas terminadas, 1 a medias`);

    const original = await huella();
    const tablas = Object.keys(original.sql.tablas).length;
    const filas = Object.values(original.sql.tablas).reduce((a, b) => a + b, 0);
    const documentos = Object.values(original.mongo.colecciones).reduce((a, b) => a + b, 0);
    paso("Estado a respaldar", `PostgreSQL: ${tablas} tablas, ${filas} filas, ${original.sql.indices} índices · MongoDB: ${Object.keys(original.mongo.colecciones).length} colecciones, ${documentos} documentos`);

    // 2) Respaldo
    const archivoPg = path.join(directorio, "postgres.dump");
    let t = performance.now();
    const pg = argumentosPg(SQL);
    await ejecutar(binarioPg("pg_dump"), ["-Fc", "--no-owner", ...pg.args, "-f", archivoPg], { env: pg.env });
    paso("Respaldo de PostgreSQL (pg_dump -Fc)", `${kb(archivoPg)} en ${ms(t)}`);
    t = performance.now();
    const colecciones = await volcarMongo(directorio);
    const tamano = colecciones.reduce((a, c) => a + fs.statSync(path.join(directorio, `${c}.ejson`)).size, 0);
    paso("Respaldo de MongoDB (volcado lógico EJSON)", `${(tamano / 1024).toFixed(0)} kB en ${ms(t)}`);

    // 3) Desastre
    await destruirTodo();
    paso("Desastre simulado", "se borran el esquema de PostgreSQL y la base de MongoDB; ambos quedan vacíos");

    // 4) Restauración
    t = performance.now();
    await ejecutar(binarioPg("pg_restore"), ["--no-owner", ...pg.args, archivoPg], { env: pg.env });
    paso("Restauración de PostgreSQL (pg_restore)", ms(t));
    t = performance.now();
    await restaurarMongo(directorio, colecciones);
    paso("Restauración de MongoDB (documentos e índices)", ms(t));

    // 5) Verificación: datos
    const restaurado = await huella();
    assert.deepEqual(restaurado.sql, original.sql, "PostgreSQL: filas e índices no coinciden");
    assert.deepEqual(restaurado.mongo, original.mongo, "MongoDB: documentos o índices no coinciden");
    paso("Datos restaurados", "mismas filas por tabla, mismos documentos por colección y los mismos índices (incluidos únicos, parciales y TTL de sesiones)");

    // 6) Verificación: el servidor real sobre lo restaurado
    const puerto = 39500 + Math.floor(Math.random() * 400);
    const detener = await arrancarServidor(puerto);
    try {
      const navegador = crearNavegador(`http://127.0.0.1:${puerto}`);
      Object.assign(navegador.estado, sesionAnterior);
      assert.equal((await navegador.llamar("/api/docentes/sesion")).status, 200, "la sesión anterior debería seguir valiendo");
      paso("La sesión de antes sigue válida", "la colección de sesiones se restauró");

      const nuevo = crearNavegador(`http://127.0.0.1:${puerto}`);
      const entrada = await nuevo.llamar("/api/docentes/sesion", { metodo: "POST", cuerpo: { correo: demo.correo, contrasena: demo.contrasena } });
      assert.equal(entrada.status, 200, "iniciar sesión con la contraseña de siempre");
      paso("Inicio de sesión con la contraseña de siempre", "el hash de la contraseña se restauró");

      for (const ruta of Object.keys(antes)) {
        assert.deepEqual((await nuevo.llamar(ruta)).cuerpo, antes[ruta], `${ruta} devuelve algo distinto tras restaurar`);
      }
      paso("La API devuelve lo mismo que antes", "cursos, biblioteca, resultados e inicio idénticos campo por campo");

      const aMedias = antes["/api/inicio"].enCurso.partidas[0];
      const actividad = demo.actividades.find((a) => a.juegoId === aMedias.juegoId);
      const ejercicios = ejerciciosDe("palabras_silabas", "naturaleza", 5);
      const respuesta = await nuevo.llamar(`/api/partidas/${aMedias.id}/intentos`, {
        metodo: "POST", cuerpo: { ejercicioId: ejercicios[aMedias.ejercicioActual].id, eleccion: eleccionCorrecta(ejercicios[aMedias.ejercicioActual]), operacionId: "tras-restaurar-1" }
      });
      assert.equal(respuesta.status, 200, "la partida a medias debería poder continuar");
      paso("Una partida a medias continúa", `«${actividad.titulo}»: se respondió el ejercicio ${aMedias.ejercicioActual + 1} sobre los datos restaurados`);
    } finally {
      await detener();
    }

    console.log(`# Prueba de respaldo y restauración (${new Date().toISOString().slice(0, 10)})\n\n${informe.join("\n")}\n\nResultado: **correcto**. Todo lo respaldado volvió y el servidor funcionó sobre ello.`);
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("\n✘ La prueba de respaldo falló:", error.message);
  process.exit(1);
});

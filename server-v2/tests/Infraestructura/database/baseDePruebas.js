const { before, after, it } = require("node:test");

// Las bases de pruebas se fijan ANTES de cargar cualquier modelo: la instancia de Sequelize
// se crea al requerirlos y toma SQL_URL en ese momento.
if (process.env.SQL_URL_TEST) process.env.SQL_URL = process.env.SQL_URL_TEST;
if (process.env.MONGO_URI_TEST) process.env.MONGO_URI = process.env.MONGO_URI_TEST;

const mongoose = require("mongoose");
const { connection: connectMongo, disconnect: disconnectMongo } = require("../../../src/Infraestructura/database/Mongo");
const { connection: connectSql, disconnect: disconnectSql, obtenerSequelize } = require("../../../src/Infraestructura/database/Sequelize");

const nombreDeBase = (url) => url.split("?")[0].split("/").pop();
const esDePruebas = (url) => /test/i.test(nombreDeBase(url));

async function prepararSql() {
  const url = process.env.SQL_URL_TEST;
  if (!url) return "OMITIDO: SQL_URL_TEST no está definida; no se ejecutaron pruebas de PostgreSQL";
  if (!esDePruebas(url)) return `OMITIDO: SQL_URL_TEST debe apuntar a una base cuyo nombre contenga "test" (${url})`;
  try {
    await obtenerSequelize().authenticate();
  } catch (error) {
    return `OMITIDO: no hay PostgreSQL disponible en SQL_URL_TEST (${error.message}); las pruebas NO se ejecutaron`;
  }
  // Code first: las tablas se recrean desde los modelos (sync con force) en cada ejecución
  await obtenerSequelize().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await connectSql({ force: true });
  return null;
}

async function prepararMongo() {
  const uri = process.env.MONGO_URI_TEST;
  if (!uri) return "OMITIDO: MONGO_URI_TEST no está definida; no se ejecutaron pruebas de MongoDB";
  if (!esDePruebas(uri)) return `OMITIDO: MONGO_URI_TEST debe apuntar a una base cuyo nombre contenga "test" (${uri})`;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  } catch (error) {
    return `OMITIDO: no hay MongoDB disponible en MONGO_URI_TEST (${error.message}); las pruebas NO se ejecutaron`;
  }
  // Code first: las colecciones e índices salen de los esquemas
  await connectMongo();
  return null;
}

// Devuelve null si se pueden usar los motores pedidos; si no, el motivo explícito para omitir.
async function prepararBase({ sql = false, mongo = true } = {}) {
  if (sql) {
    const motivo = await prepararSql();
    if (motivo) return motivo;
  }
  if (mongo) {
    const motivo = await prepararMongo();
    if (motivo) return motivo;
  }
  return null;
}

async function cerrarConexiones() {
  await disconnectMongo();
  await disconnectSql();
}

// Registra los hooks del archivo de prueba y devuelve `prueba(nombre, fn)`, que se omite
// con un mensaje explícito si no hay base de pruebas disponible (nunca pasa en falso).
// Indique en `motores` qué bases necesita el archivo: { sql: true } y/o { mongo: true }.
function pruebasConBase(etiqueta, motores = { mongo: true }) {
  let motivo = null;
  before(async () => {
    motivo = await prepararBase(motores);
    if (motivo) console.warn(`\n[${etiqueta}] ${motivo}\n`);
  });
  after(async () => {
    await cerrarConexiones();
  });
  return (nombre, fn) =>
    it(nombre, async (t) => {
      if (motivo) return t.skip(motivo);
      await fn();
    });
}

module.exports = { prepararBase, cerrarConexiones, pruebasConBase };

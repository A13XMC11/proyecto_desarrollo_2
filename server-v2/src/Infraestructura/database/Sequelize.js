const { Sequelize } = require("sequelize");
const cargarModelos = require("./cargarModelos");

const DEFAULT_URL = "postgres://postgres@127.0.0.1:5432/minijuegos_dev";

let instancia = null;

// Los modelos se definen sobre esta instancia al requerirse, por eso es única y perezosa.
function obtenerSequelize() {
  if (!instancia) {
    instancia = new Sequelize(process.env.SQL_URL || DEFAULT_URL, {
      dialect: "postgres",
      logging: false,
      define: {
        underscored: true,
        freezeTableName: true,
        createdAt: "creadoEn",
        updatedAt: "actualizadoEn"
      }
    });
  }
  return instancia;
}

// Code first, como "ddl-auto=update" de Hibernate: al conectar crea las tablas que falten y ajusta las
// existentes a los modelos (añade columnas e índices). Solo para desarrollo: en producción poner
// SQL_SYNC_ALTER=false para que solo cree lo que falta. Con { force: true } recrea todo (solo pruebas).
async function connection({ force = false } = {}) {
  const sequelize = obtenerSequelize();
  const alter = process.env.SQL_SYNC_ALTER !== "false";

  try {
    await sequelize.authenticate();
    cargarModelos();
    await sequelize.sync(force ? { force: true } : { alter });
    console.log(`Se ha conectado a la bdd SQL: ${sequelize.getDatabaseName()}`);
  } catch (error) {
    console.error("Error conectando a PostgreSQL:", error);
    throw new Error("No se ha podido establecer la conexión a la bdd SQL");
  }
}

async function disconnect() {
  if (instancia) {
    await instancia.close();
    console.log("PostgreSQL desconectado correctamente");
  }
}

module.exports = { obtenerSequelize, connection, disconnect };

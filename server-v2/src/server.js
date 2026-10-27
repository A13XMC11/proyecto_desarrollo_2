const buildApp = require("./app");
const { connection: connectMongo, disconnect: disconnectMongo } = require("./Infraestructura/database/Mongo");
const { connection: connectSql, disconnect: disconnectSql } = require("./Infraestructura/database/Sequelize");
const { crearAsegurarCanales } = require("./lib/Canal/Infraestructura/http");

async function start() {
  const port = Number(process.env.PORT) || 3977;

  // Conectar primero a las dos BD; al conectar se crean tablas y colecciones desde los modelos (code first)
  await connectSql();
  await connectMongo();
  await crearAsegurarCanales().ejecutar();

  const app = buildApp();

  const server = app.listen(port, () => {
    console.log("Servidor esta corriendo correctamente en el puerto: " + port);
  });

  const cerrar = async () => {
    server.close();
    await disconnectMongo();
    await disconnectSql();
    process.exit(0);
  };
  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
}

start().catch((e) => {
  console.error("Fallo al iniciar la aplicación:", e);
  process.exit(1);
});

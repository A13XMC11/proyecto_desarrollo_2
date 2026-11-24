const mongoose = require("mongoose");
const cargarModelos = require("./cargarModelos");

const DEFAULT_URI = "mongodb://127.0.0.1:27017/minijuegos-dev";

const TIEMPO_SELECCION_SERVIDOR_MS = 5000;

let oyentesRegistrados = false;

async function connection() {
  const uri = process.env.MONGO_URI || DEFAULT_URI;

  try {
    if (mongoose.connection.readyState === 1) return;

    cargarModelos();
    // Si Mongo no responde, falla en 5 s en vez de esperar los 30 s por defecto del driver
    await mongoose.connect(uri, { serverSelectionTimeoutMS: TIEMPO_SELECCION_SERVIDOR_MS });

    // Code first: construye las colecciones e índices declarados en los esquemas
    await Promise.all(Object.values(mongoose.models).map((modelo) => modelo.init()));

    // connect-mongo crea este índice al construir el middleware, pero esa operación
    // es asíncrona. Debe estar listo antes de que el servidor empiece a escuchar.
    await mongoose.connection.collection("sesiones").createIndex(
      { expires: 1 },
      { expireAfterSeconds: 0 }
    );

    console.log(`Se ha conectado a la bdd Mongo: ${mongoose.connection.name}`);

    if (!oyentesRegistrados) {
      oyentesRegistrados = true;
      mongoose.connection.on("disconnected", () => {
        console.warn("MongoDB desconectado");
      });

      mongoose.connection.on("error", (err) => {
        console.error("MongoDB error:", err);
      });
    }
  } catch (error) {
    console.error("Error conectando a MongoDB:", error);
    throw new Error("No se ha podido establecer la conexión a la bdd Mongo");
  }
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("MongoDB desconectado correctamente");
  }
}

// Cliente nativo de la conexión de Mongoose, cuando esté conectada. Lo usa el almacén de sesiones para no
// abrir una segunda conexión. Si aún no se conectó (buildApp() se crea antes), espera al evento.
function obtenerClienteMongo() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection.getClient());
  return new Promise((resolver) => {
    mongoose.connection.once("connected", () => resolver(mongoose.connection.getClient()));
  });
}

module.exports = { connection, disconnect, obtenerClienteMongo };

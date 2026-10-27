const mongoose = require("mongoose");
const cargarModelos = require("./cargarModelos");

const DEFAULT_URI = "mongodb://127.0.0.1:27017/minijuegos-dev";

let oyentesRegistrados = false;

async function connection() {
  const uri = process.env.MONGO_URI || DEFAULT_URI;

  try {
    if (mongoose.connection.readyState === 1) return;

    cargarModelos();
    await mongoose.connect(uri);

    // Code first: construye las colecciones e índices declarados en los esquemas
    await Promise.all(Object.values(mongoose.models).map((modelo) => modelo.init()));

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

module.exports = { connection, disconnect };

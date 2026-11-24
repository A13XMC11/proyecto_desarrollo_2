const mongoose = require("mongoose");
const { obtenerSequelize } = require("../database/Sequelize");

// Estado de salud: responde 200 solo si las dos bases contestan. Cada comprobación tiene un tope de tiempo
// para que el endpoint nunca se quede colgado cuando una base cae.
const TOPE_COMPROBACION_MS = 2000;

async function pingMongo() {
  if (mongoose.connection.readyState !== 1) throw new Error("MongoDB sin conexión");
  await mongoose.connection.db.admin().ping();
}

async function pingSql() {
  await obtenerSequelize().authenticate();
}

function conTope(promesa, ms) {
  let temporizador;
  const tope = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("sin respuesta a tiempo")), ms);
  });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(temporizador));
}

async function estadoDe(comprobar, ms) {
  try {
    await conTope(comprobar(), ms);
    return "ok";
  } catch {
    return "caida";
  }
}

// comprobaciones: { sql, mongo } funciones async que lanzan si la base no responde (inyectables en pruebas)
async function comprobarSalud({ sql = pingSql, mongo = pingMongo, topeMs = TOPE_COMPROBACION_MS } = {}) {
  const [estadoSql, estadoMongo] = await Promise.all([estadoDe(sql, topeMs), estadoDe(mongo, topeMs)]);
  const ok = estadoSql === "ok" && estadoMongo === "ok";
  return { ok, bases: { sql: estadoSql, mongo: estadoMongo } };
}

function manejadorSalud(opciones) {
  return async (req, res) => {
    const salud = await comprobarSalud(opciones);
    res.status(salud.ok ? 200 : 503).json(salud);
  };
}

module.exports = { comprobarSalud, manejadorSalud };

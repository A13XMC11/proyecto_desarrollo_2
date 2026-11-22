// S6-02 y criterio de cierre: «una base vacía queda lista solo arrancando el servidor; los índices únicos están presentes».
// El proyecto es code first: no hay migraciones numeradas, el esquema sale de los modelos al conectar (decisión del
// equipo, ver docs/recuperacion.md). Esta prueba demuestra el criterio con el proceso REAL del servidor, no con un
// atajo de las pruebas: vacía las dos bases de pruebas, arranca `node index.js` con SQL_SYNC_ALTER=false (como en
// producción) y comprueba tablas, índices y datos iniciales.
const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const mongoose = require("mongoose");
const { Op } = require("sequelize");
const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { obtenerSequelize } = require("../../src/Infraestructura/database/Sequelize");

const prueba = pruebasConBase("BaseDesdeCero", { sql: true, mongo: true });
const RAIZ = path.resolve(__dirname, "../..");
const PUERTO = 39000 + Math.floor(Math.random() * 900);

// Arranca el servidor como lo haría el alojamiento y espera a que diga que está escuchando
function arrancarServidor() {
  const proceso = spawn(process.execPath, ["index.js"], {
    cwd: RAIZ,
    env: {
      ...process.env, PORT: String(PUERTO), NODE_ENV: "development", SQL_SYNC_ALTER: "false", AI_ENABLED: "false",
      SQL_URL: process.env.SQL_URL_TEST, MONGO_URI: process.env.MONGO_URI_TEST, SESSION_SECRET: "secreto-de-prueba-base-vacia"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let salida = "";
  const listo = new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error(`el servidor no arrancó en 20 s:\n${salida}`)), 20000);
    const alLeer = (d) => {
      salida += d;
      if (salida.includes("corriendo correctamente")) { clearTimeout(limite); resolver(); }
    };
    proceso.stdout.on("data", alLeer);
    proceso.stderr.on("data", (d) => { salida += d; });
    proceso.on("exit", (codigo) => { clearTimeout(limite); rechazar(new Error(`el servidor terminó con código ${codigo}:\n${salida}`)); });
  });
  return { proceso, listo };
}

describe("Base desde cero", () => {
  prueba("arrancar el servidor sobre bases vacías deja tablas, índices únicos, canales y validación listos", async () => {
    // 1) Bases completamente vacías
    const sql = obtenerSequelize();
    await sql.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await mongoose.connection.dropDatabase();
    const [vacias] = await sql.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'");
    assert.equal(vacias[0].n, 0, "PostgreSQL empieza sin tablas");

    // 2) Arranque del servidor real, con SQL_SYNC_ALTER=false
    const { proceso, listo } = arrancarServidor();
    try {
      await listo;
      const salud = await fetch(`http://127.0.0.1:${PUERTO}/api/health`);
      assert.equal(salud.status, 200);
    } finally {
      proceso.removeAllListeners("exit");
      proceso.kill("SIGTERM");
      await new Promise((resolver) => proceso.once("exit", resolver));
    }

    // 3) PostgreSQL: tablas e índices únicos declarados en los modelos
    const modelos = Object.values(sql.models);
    // pg_tables y no information_schema: este último oculta las tablas sobre las que la sesión no tiene privilegios
    const [tablas] = await sql.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const existentes = new Set(tablas.map((t) => t.tablename));
    for (const modelo of modelos) assert.ok(existentes.has(modelo.getTableName()), `falta la tabla ${modelo.getTableName()}`);

    const [indices] = await sql.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'");
    const porNombre = new Map(indices.map((i) => [i.indexname, i]));
    let declarados = 0;
    for (const modelo of modelos) {
      for (const declarado of modelo.options.indexes || []) {
        declarados += 1;
        const real = porNombre.get(declarado.name);
        assert.ok(real, `falta el índice ${declarado.name} de ${modelo.getTableName()}`);
        assert.equal(/UNIQUE/i.test(real.indexdef), Boolean(declarado.unique), `${declarado.name}: la unicidad no coincide`);
      }
    }
    assert.ok(declarados >= 6, `se esperaban al menos 6 índices declarados y hay ${declarados}`);
    const unico = (tabla, ...columnas) => indices.some((i) => i.tablename === tabla && /UNIQUE/i.test(i.indexdef) && columnas.every((c) => i.indexdef.includes(c)));
    assert.ok(unico("usuarios", "correo"), "el correo del docente es único");
    assert.ok(unico("generaciones_ia", "docente_id", "clave_solicitud"), "la solicitud de generación es única por docente (idempotencia)");
    assert.ok(unico("generaciones_ia", "juego_id") || unico("generaciones_ia", "juegoId"), "una generación tiene a lo sumo un juego");

    // 4) MongoDB: colecciones e índices declarados, con su unicidad
    for (const modelo of Object.values(mongoose.models)) {
      const reales = await mongoose.connection.collection(modelo.collection.name).indexes();
      const porNombreM = new Map(reales.map((i) => [i.name, i]));
      for (const [campos, opciones] of modelo.schema.indexes()) {
        const nombre = opciones.name || Object.entries(campos).map(([k, v]) => `${k}_${v}`).join("_");
        const real = porNombreM.get(nombre);
        assert.ok(real, `falta el índice ${nombre} en ${modelo.collection.name}`);
        assert.equal(Boolean(real.unique), Boolean(opciones.unique), `${modelo.collection.name}.${nombre}: la unicidad no coincide`);
        if (opciones.partialFilterExpression) assert.ok(real.partialFilterExpression, `${nombre} debe ser parcial`);
      }
    }
    // El almacén de sesiones crea su propio índice de caducidad (TTL): borra las vencidas sin temporizadores
    const sesiones = await mongoose.connection.collection("sesiones").indexes().catch(() => []);
    assert.ok(sesiones.some((i) => i.expireAfterSeconds !== undefined), "las sesiones caducan con un índice TTL");

    // 5) Datos iniciales: los canales se siembran solos al arrancar
    const canales = await mongoose.connection.collection("canales").countDocuments();
    assert.equal(canales, 4, "los cuatro canales (docente/aula × computador/tableta)");

    // 6) Validación: el modelo rechaza datos inválidos (en este proyecto la validación vive en los modelos, no en $jsonSchema)
    const Docente = sql.models.Docente;
    await assert.rejects(Docente.create({ nombre: "A", correo: "no-es-correo", hash: "x" }), /Validation/i);
    const duplicado = { nombre: "Docente Uno", correo: "unico@escuela.ec", hash: "x" };
    await Docente.create(duplicado);
    await assert.rejects(Docente.create({ ...duplicado, nombre: "Docente Dos" }), /unique|Unique/i, "el índice único impide el correo repetido");
    assert.equal(await Docente.count({ where: { correo: { [Op.eq]: "unico@escuela.ec" } } }), 1);
  });
});

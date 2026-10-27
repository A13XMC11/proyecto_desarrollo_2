const { describe } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { obtenerSequelize, connection: conectarSql } = require("../../src/Infraestructura/database/Sequelize");

const prueba = pruebasConBase("codeFirst", { sql: true, mongo: true });
const consultar = async (sql, replacements) => (await obtenerSequelize().query(sql, { replacements }))[0];

describe("Code first: el esquema sale de los modelos (sin migraciones ni DDL escrito a mano)", () => {
  prueba("PostgreSQL: se crean las 7 tablas con sus claves foráneas", async () => {
    const tablas = (await consultar("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).map((t) => t.tablename);
    assert.deepEqual(tablas, ["cuotas_ia", "cursos", "estudiante_intereses", "estudiantes", "generaciones_ia", "reservas_ia", "usuarios"]);

    const fks = await consultar(`
      SELECT conrelid::regclass::text AS tabla, confrelid::regclass::text AS destino
      FROM pg_constraint WHERE contype = 'f' ORDER BY 1, 2`);
    const pares = fks.map((f) => `${f.tabla}->${f.destino}`);
    for (const esperado of [
      "cursos->usuarios", "estudiantes->cursos", "estudiante_intereses->estudiantes", "cuotas_ia->usuarios",
      "generaciones_ia->usuarios", "generaciones_ia->cursos", "generaciones_ia->estudiantes",
      "reservas_ia->generaciones_ia", "reservas_ia->cuotas_ia"
    ]) {
      assert.ok(pares.includes(esperado), `falta la clave foránea ${esperado}`);
    }
  });

  prueba("PostgreSQL: unicidades e índices parciales declarados en los modelos", async () => {
    const indices = (await consultar("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).map((i) => i.indexname);
    for (const esperado of [
      "usuarios_correo_key", "curso_unico_por_docente", "codigo_unico_por_curso", "solicitud_unica_por_docente",
      "una_cuota_por_docente_y_periodo", "una_cuota_global_por_periodo", "conciliacion_por_antiguedad"
    ]) {
      assert.ok(indices.includes(esperado), `falta el índice ${esperado}`);
    }
  });

  prueba("PostgreSQL: la normalización queda en el esquema (sin docente en estudiantes, sin mecánica ni periodos duplicados)", async () => {
    const columnas = async (tabla) =>
      (await consultar("SELECT column_name FROM information_schema.columns WHERE table_name = :tabla", { tabla })).map((c) => c.column_name);
    assert.ok(!(await columnas("estudiantes")).includes("docente_id"));
    assert.ok(!(await columnas("generaciones_ia")).includes("mecanica"));
    assert.ok(!(await columnas("reservas_ia")).some((c) => c.startsWith("periodo")));
    assert.ok((await columnas("cuotas_ia")).includes("docente_id"));
  });

  prueba("PostgreSQL: sync es idempotente (no falla ni pierde datos al reconectar)", async () => {
    await obtenerSequelize().query("INSERT INTO usuarios (id, nombre, correo, hash, creado_en, actualizado_en) VALUES (gen_random_uuid(), 'Ana', 'idem@x.ec', 'h', now(), now())");
    await conectarSql();
    assert.equal((await consultar("SELECT count(*)::int AS n FROM usuarios"))[0].n, 1);
  });

  prueba("MongoDB: colecciones e índices salen de los esquemas", async () => {
    const colecciones = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name).sort();
    assert.deepEqual(colecciones, ["canales", "interacciones", "juegos", "sesionesJuego", "versionesJuego"]);

    const nombres = async (coleccion) => (await mongoose.connection.db.collection(coleccion).indexes()).map((i) => i.name);
    assert.ok((await nombres("canales")).includes("codigo_unico"));
    assert.ok((await nombres("versionesJuego")).includes("numero_unico_por_juego"));
    assert.ok((await nombres("versionesJuego")).includes("un_borrador_por_juego_parcial"));
    assert.ok((await nombres("sesionesJuego")).includes("una_partida_en_curso_parcial"));
    assert.ok((await nombres("juegos")).includes("generacion_unica_parcial"));
    assert.ok((await nombres("interacciones")).includes("operacion_unica_por_sesion_tipo_parcial"));
  });
});

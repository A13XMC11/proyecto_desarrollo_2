const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID: uuid, randomBytes } = require("node:crypto");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const { crearEscenario } = require("../../../Infraestructura/database/fixturesSql");
const Generacion = require("../../../../src/lib/Generacion/Dominio/Entidades/Generacion");
const Repo = require("../../../../src/lib/Generacion/Infraestructura/GeneracionRepositorySequelize");
const FiltroContenidoJson = require("../../../../src/lib/Juego/Infraestructura/FiltroContenidoJson");
const { obtenerSequelize } = require("../../../../src/Infraestructura/database/Sequelize");

const prueba = pruebasConBase("GeneracionModoTematica", { sql: true, mongo: false });
const repo = new Repo();
const filtroContenido = new FiltroContenidoJson();
const oid = () => randomBytes(12).toString("hex");
let contador = 0;
const clave = () => `clave-modo-tematica-${String(++contador).padStart(6, "0")}`;

const gen = (esc, parametros, claveSolicitud = clave()) => new Generacion({
  docenteId: esc.docenteId, canalId: oid(), claveSolicitud, filtroContenido,
  parametros: { cursoId: esc.cursoId, habilidad: "vocales", cantidad: 5, ...parametros }
});

// Inserta una fila SIN la columna modo_tematica, como la dejaba la versión anterior: así se prueba el valor por defecto de la base
const insertarFilaAntigua = async (esc, tematica = "animales") => {
  const id = uuid();
  await obtenerSequelize().query(
    `INSERT INTO generaciones_ia (id, docente_id, curso_id, canal_id, clave_solicitud, habilidad, tematica, cantidad, estado, creada_en, actualizado_en)
     VALUES (:id, :docenteId, :cursoId, :canalId, :clave, 'vocales', :tematica, 5, 'pendiente', now(), now())`,
    { replacements: { id, docenteId: esc.docenteId, cursoId: esc.cursoId, canalId: oid(), clave: clave(), tematica } }
  );
  return id;
};
const columna = async (nombre) => (await obtenerSequelize().query(
  "SELECT data_type, character_maximum_length, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'generaciones_ia' AND column_name = :nombre",
  { replacements: { nombre }, type: "SELECT" }
))[0];

describe("GeneracionRepositorySequelize: modo de temática (paso 3)", () => {
  prueba("(c) la columna tematica acepta texto libre y se lee igual que se guardó", async () => {
    const esc = await crearEscenario();
    const { generacion, esNueva } = await repo.save(gen(esc, { modoTematica: "libre", tematica: "Sonidos de Animales" }));
    assert.equal(esNueva, true);
    assert.equal(generacion.parametros.modoTematica, "libre");
    assert.equal(generacion.parametros.tematica, "sonidos de animales");
    const releida = await repo.findById(generacion.id, esc.docenteId);
    assert.deepEqual([releida.parametros.modoTematica, releida.parametros.tematica], ["libre", "sonidos de animales"]);
    assert.ok(releida instanceof Generacion);
    assert.equal(releida.filtroContenido, undefined, "al leer no hace falta el filtro");
  });

  prueba("el esquema: tematica es varchar(40) y modo_tematica tiene valor por defecto 'catalogo'", async () => {
    const tematica = await columna("tematica");
    assert.equal(tematica.data_type, "character varying", "ya no es un ENUM");
    assert.equal(tematica.character_maximum_length, 40);
    const modo = await columna("modo_tematica");
    assert.ok(modo, "falta la columna modo_tematica");
    assert.equal(modo.is_nullable, "NO");
    assert.match(modo.column_default, /catalogo/);
  });

  prueba("una fila sin modo_tematica toma 'catalogo' de la base y se lee como del catálogo", async () => {
    const esc = await crearEscenario();
    const id = await insertarFilaAntigua(esc);
    const [fila] = await obtenerSequelize().query("SELECT modo_tematica FROM generaciones_ia WHERE id = :id", { replacements: { id }, type: "SELECT" });
    assert.equal(fila.modo_tematica, "catalogo");
    const leida = await repo.findById(id, esc.docenteId);
    assert.deepEqual([leida.parametros.modoTematica, leida.parametros.tematica], ["catalogo", "animales"]);
  });

  prueba("la base es la última barrera: rechaza un texto de más de 40 caracteres y un modo desconocido", async () => {
    const esc = await crearEscenario();
    await assert.rejects(insertarFilaAntigua(esc, "a".repeat(41)), (e) => e.original && e.original.code === "22001", "texto demasiado largo");
    await assert.rejects(
      obtenerSequelize().query(
        `INSERT INTO generaciones_ia (id, docente_id, curso_id, canal_id, clave_solicitud, habilidad, tematica, modo_tematica, cantidad, estado, creada_en, actualizado_en)
         VALUES (:id, :docenteId, :cursoId, :canalId, :clave, 'vocales', 'animales', 'otro', 5, 'pendiente', now(), now())`,
        { replacements: { id: uuid(), docenteId: esc.docenteId, cursoId: esc.cursoId, canalId: oid(), clave: clave() } }
      ),
      (e) => e.original && e.original.code === "22P02", "modo desconocido"
    );
  });

  prueba("(d) la misma clave con los mismos datos salvo modoTematica no es la misma solicitud: la base devuelve la original", async () => {
    const esc = await crearEscenario();
    const k = clave();
    const delCatalogo = await repo.save(gen(esc, { modoTematica: "catalogo", tematica: "animales" }, k));
    const libre = await repo.save(gen(esc, { modoTematica: "libre", tematica: "animales" }, k));
    assert.equal(delCatalogo.esNueva, true);
    assert.equal(libre.esNueva, false, "la clave ya existía");
    assert.equal(libre.generacion.id, delCatalogo.generacion.id);
    assert.equal(libre.generacion.parametros.modoTematica, "catalogo", "se conserva la original: el llamador compara y detecta la diferencia");

    const k2 = clave();
    const primeraLibre = await repo.save(gen(esc, { modoTematica: "libre", tematica: "animales" }, k2));
    const luegoCatalogo = await repo.save(gen(esc, { modoTematica: "catalogo", tematica: "animales" }, k2));
    assert.equal(luegoCatalogo.esNueva, false);
    assert.equal(luegoCatalogo.generacion.parametros.modoTematica, "libre");
    assert.equal(luegoCatalogo.generacion.id, primeraLibre.generacion.id);
  });
});

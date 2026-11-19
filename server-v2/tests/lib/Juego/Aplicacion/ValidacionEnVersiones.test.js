const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const CrearVersion = require("../../../../src/lib/Juego/Aplicacion/CrearVersion");
const ActualizarVersion = require("../../../../src/lib/Juego/Aplicacion/ActualizarVersion");
const AprobarVersion = require("../../../../src/lib/Juego/Aplicacion/AprobarVersion");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const CatalogoRecursosJson = require("../../../../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const catalogo = new CatalogoRecursosJson();
const VOCALES = ["a", "e", "i", "o", "u"];
const deVocal = (v) => catalogo.listar({ tematica: "animales" }).find((r) => r.vocalInicial === v);

const vocal = (n, extra = {}) => {
  const v = VOCALES[(n - 1) % 5];
  const otras = VOCALES.filter((x) => x !== v).slice(0, 2);
  return {
    id: `e${n}`, consigna: "¿Con qué vocal empieza esta palabra?", recursoId: deVocal(v).id,
    opciones: [v, ...otras].map((t) => ({ id: `o-${t}`, texto: t })), respuestaCorrectaId: `o-${v}`, ...extra
  };
};
const cinco = () => [1, 2, 3, 4, 5].map((n) => vocal(n));

const juego = { id: "j1", docenteId: "d1", habilidad: "vocales", mecanica: "seleccionar_opcion", estado: "borrador" };
const juegoRepo = { findById: async () => juego, marcarListoConVersion: async () => ({ ...juego, estado: "listo" }) };

function versionRepoCon(version) {
  const guardados = [];
  return {
    guardados,
    save: async (v) => { guardados.push(v); return v; },
    findById: async () => version,
    actualizarBorrador: async (id, jId, cambios) => { guardados.push(cambios); return { ...version, ...cambios }; },
    aprobar: async () => ({ ...version, estado: "aprobada" })
  };
}
const borrador = (ejercicios) => new VersionJuego({
  id: "v1", juegoId: "j1", numero: 1,
  configuracion: { habilidad: "vocales", mecanica: "seleccionar_opcion", tematica: "animales", cantidadEjercicios: 5 },
  ejercicios
});
const datos = (ejercicios, extra = {}) => ({ tematica: "animales", cantidadEjercicios: 5, ejercicios, ...extra });

describe("CrearVersion valida el contenido contra el catálogo", () => {
  const crear = (repo = versionRepoCon()) => ({ repo, caso: new CrearVersion(repo, juegoRepo, catalogo) });

  it("guarda un borrador coherente, completo o parcial", async () => {
    const { repo, caso } = crear();
    await caso.ejecutar("d1", "j1", datos(cinco()));
    await caso.ejecutar("d1", "j1", datos([vocal(1)]));
    await caso.ejecutar("d1", "j1", datos([]));
    await caso.ejecutar("d1", "j1", { tematica: "animales", cantidadEjercicios: 5 });
    assert.equal(repo.guardados.length, 4);
  });

  it("rechaza un recurso inexistente y no guarda nada", async () => {
    const { repo, caso } = crear();
    await assert.rejects(caso.ejecutar("d1", "j1", datos([vocal(1, { recursoId: "fantasma" })])), EntradaInvalida);
    assert.equal(repo.guardados.length, 0);
  });

  it("rechaza un recurso de otra temática", async () => {
    const { caso } = crear();
    const uva = catalogo.obtenerRecurso("uva");
    await assert.rejects(caso.ejecutar("d1", "j1", datos([vocal(5, { recursoId: uva.id })])), /temática/);
  });

  it("rechaza una respuesta que no es la vocal inicial", async () => {
    const { caso } = crear();
    await assert.rejects(caso.ejecutar("d1", "j1", datos([vocal(1, { respuestaCorrectaId: "o-e" })])), /vocal inicial/);
  });

  it("rechaza campos desconocidos en vez de descartarlos en silencio", async () => {
    const { caso } = crear();
    await assert.rejects(caso.ejecutar("d1", "j1", datos([vocal(1, { respuesta: "a" })])), /campo desconocido/);
  });

  it("rechaza la consigna que contiene la respuesta", async () => {
    const { caso } = crear();
    await assert.rejects(caso.ejecutar("d1", "j1", datos([vocal(1, { consigna: "La palabra abeja, ¿con qué vocal empieza?" })])), /contiene la respuesta/);
  });

  it("rechaza 10 ejercicios mientras no estén habilitados, y los acepta si se habilitan", async () => {
    await assert.rejects(crear().caso.ejecutar("d1", "j1", datos([], { cantidadEjercicios: 10 })), /10 ejercicios/);
    const habilitado = new CrearVersion(versionRepoCon(), juegoRepo, catalogo, { permitirDiez: true });
    await assert.doesNotReject(habilitado.ejecutar("d1", "j1", datos([], { cantidadEjercicios: 10 })));
  });
});

describe("ActualizarVersion valida el contenido contra el catálogo", () => {
  const actualizar = (repo) => new ActualizarVersion(repo, juegoRepo, catalogo);

  it("acepta ejercicios coherentes", async () => {
    const repo = versionRepoCon(borrador([]));
    await actualizar(repo).ejecutar("d1", "j1", "v1", { ejercicios: cinco() });
    assert.equal(repo.guardados.length, 1);
  });

  it("rechaza un recurso inexistente sin tocar lo guardado", async () => {
    const repo = versionRepoCon(borrador([vocal(1)]));
    await assert.rejects(actualizar(repo).ejecutar("d1", "j1", "v1", { ejercicios: [vocal(1, { recursoId: "fantasma" })] }), EntradaInvalida);
    assert.equal(repo.guardados.length, 0);
  });

  it("rechaza consigna y respuesta repetidas", async () => {
    const repo = versionRepoCon(borrador([]));
    await assert.rejects(actualizar(repo).ejecutar("d1", "j1", "v1", { ejercicios: [vocal(1), vocal(6)] }), /repetidas/);
  });
});

describe("AprobarVersion vuelve a validar antes de aprobar", () => {
  const aprobar = (repo, cat = catalogo) => new AprobarVersion(repo, juegoRepo, cat);

  it("aprueba un borrador completo y coherente", async () => {
    const r = await aprobar(versionRepoCon(borrador(cinco()))).ejecutar("d1", "j1", "v1");
    assert.equal(r.version.estado, "aprobada");
  });

  it("rechaza un borrador incompleto", async () => {
    await assert.rejects(aprobar(versionRepoCon(borrador([vocal(1)]))).ejecutar("d1", "j1", "v1"), EntradaInvalida);
  });

  it("rechaza si el recurso ya no está en el catálogo", async () => {
    const sinOso = { obtenerRecurso: (id) => (id === "oso" ? undefined : catalogo.obtenerRecurso(id)) };
    await assert.rejects(aprobar(versionRepoCon(borrador(cinco())), sinOso).ejecutar("d1", "j1", "v1"), /no existe en el catálogo/);
  });

  it("rechaza un borrador heredado con contenido libre (sin recursos)", async () => {
    const libre = [1, 2, 3, 4, 5].map((n) => ({
      id: `e${n}`, consigna: "¿Con qué vocal empieza?", opciones: [{ id: "a", texto: "a" }, { id: "e", texto: "e" }, { id: "i", texto: "i" }], respuestaCorrectaId: "a"
    }));
    await assert.rejects(aprobar(versionRepoCon(borrador(libre))).ejecutar("d1", "j1", "v1"), EntradaInvalida);
  });
});

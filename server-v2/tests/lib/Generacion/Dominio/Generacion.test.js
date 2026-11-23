const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Generacion = require("../../../../src/lib/Generacion/Dominio/Entidades/Generacion");
const Cuota = require("../../../../src/lib/Generacion/Dominio/Entidades/Cuota");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");

const gen = {
  docenteId: "d1", canalId: "k1", claveSolicitud: "clave-solicitud-0001",
  parametros: { cursoId: "c1", habilidad: "vocales", mecanica: "seleccionar_opcion", tematica: "animales", cantidad: 5 }
};

describe("Entidad Generacion", () => {
  it("nace pendiente y activa", () => {
    const g = new Generacion(gen);
    assert.equal(g.estado, "pendiente");
    assert.equal(g.estaActiva(), true);
    assert.equal(new Generacion({ ...gen, estado: "completada" }).estaActiva(), false);
  });

  it("deduce la mecánica de la habilidad y no exige informarla", () => {
    const { mecanica, ...sinMecanica } = gen.parametros;
    const g = new Generacion({ ...gen, parametros: sinMecanica });
    assert.equal(g.mecanica, "seleccionar_opcion");
    assert.equal(g.parametros.mecanica, undefined);
    assert.equal(new Generacion({ ...gen, parametros: { ...sinMecanica, habilidad: "palabras_silabas" } }).mecanica, "ordenar_silabas");
  });

  it("rechaza datos inválidos", () => {
    const p = gen.parametros;
    for (const malo of [
      { ...gen, claveSolicitud: "corta" },
      { ...gen, claveSolicitud: "x".repeat(65) },
      { ...gen, parametros: undefined },
      { ...gen, parametros: { ...p, mecanica: "ordenar_silabas" } }, // incompatible con la habilidad
      { ...gen, parametros: { ...p, tematica: "cine" } },
      { ...gen, parametros: { ...p, cantidad: 7 } },
      { ...gen, parametros: { ...p, instruccion: "x".repeat(501) } },
      { ...gen, parametros: { ...p, instruccion: "escribe a a@b.com" } },
      { ...gen, parametros: { ...p, instruccion: "<script>" } },
      { ...gen, estado: "otro" },
      { ...gen, tokensEntrada: -1 },
      { ...gen, docenteId: undefined }
    ]) {
      assert.throws(() => new Generacion(malo), EntradaInvalida);
    }
  });
});

describe("Entidad Cuota", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";

  it("acepta contadores de docente y global y calcula lo disponible", () => {
    const c = new Cuota({ docenteId: id, periodo: "2026-10-21", reservado: 1, consumido: 1 });
    assert.equal(c.disponible(3), 1);
    assert.equal(c.disponible(1), 0);
    assert.equal(c.esGlobal(), false);
    assert.equal(new Cuota({ periodo: "2026-10" }).esGlobal(), true);
  });

  it("rechaza periodo y montos inválidos", () => {
    for (const malo of [
      { periodo: "2026-1" },
      { periodo: "otro" },
      { periodo: "2026-10", reservado: -1 },
      { periodo: "2026-10", consumido: "x" }
    ]) {
      assert.throws(() => new Cuota(malo), EntradaInvalida);
    }
  });
});

describe("Entidad Generacion: modo de temática (paso 3)", () => {
  // Un filtro falso que cumple el puerto IFiltroContenido: bloquea solo la palabra "armas"
  const filtro = { evaluar: (texto) => (/\barmas\b/i.test(texto) ? { permitido: false, categoria: "armas" } : { permitido: true }) };
  const { mecanica, ...base } = gen.parametros;
  const libre = (tematica, extra = {}) => ({ ...gen, filtroContenido: filtro, parametros: { ...base, modoTematica: "libre", tematica }, ...extra });

  it("sin modoTematica es del catálogo, igual que antes", () => {
    const g = new Generacion(gen);
    assert.equal(g.parametros.modoTematica, "catalogo");
    assert.equal(g.parametros.tematica, "animales");
    assert.equal(new Generacion({ ...gen, parametros: { ...gen.parametros, modoTematica: "catalogo" } }).parametros.modoTematica, "catalogo");
  });

  it("en modo catálogo la temática sigue siendo del enum", () => {
    for (const malo of ["cine", "sonidos de animales", "", undefined]) {
      assert.throws(() => new Generacion({ ...gen, parametros: { ...gen.parametros, tematica: malo } }), EntradaInvalida, String(malo));
    }
    for (const buena of ["animales", "objetos_cotidianos", "naturaleza", "cuerpo", "escuela"]) {
      assert.equal(new Generacion({ ...gen, parametros: { ...gen.parametros, tematica: buena } }).parametros.tematica, buena);
    }
  });

  it("el modo debe ser uno de los permitidos", () => {
    for (const malo of ["otro", "LIBRE", "", null, 1]) {
      assert.throws(() => new Generacion({ ...gen, filtroContenido: filtro, parametros: { ...base, modoTematica: malo, tematica: "animales" } }), EntradaInvalida, String(malo));
    }
  });

  it("en modo libre la temática se normaliza y queda como texto", () => {
    const g = new Generacion(libre("  Sonidos   de ANIMALES "));
    assert.equal(g.parametros.modoTematica, "libre");
    assert.equal(g.parametros.tematica, "sonidos de animales");
  });

  it("en modo libre solo se admiten letras y espacios, de 3 a 40 caracteres", () => {
    for (const malo of ["ab", "a".repeat(41), "frutas2", "frutas!", "<b>frutas</b>", "", undefined, 7]) {
      assert.throws(() => new Generacion(libre(malo)), EntradaInvalida, String(malo));
    }
  });

  it("en modo libre debe pasar el filtro de contenido, y el error no repite la temática", () => {
    assert.throws(
      () => new Generacion(libre("Armas y más armas")),
      (e) => e instanceof EntradaInvalida && e.codigo === "TEMATICA_NO_PERMITIDA" && !/armas/i.test(e.message)
    );
    assert.equal(new Generacion(libre("frutas tropicales")).parametros.tematica, "frutas tropicales");
  });

  it("sin filtro no se puede crear una temática libre nueva (falla cerrado)", () => {
    const { filtroContenido, ...sinFiltro } = libre("frutas");
    assert.throws(() => new Generacion(sinFiltro), (e) => e instanceof EntradaInvalida && e.codigo === "FILTRO_CONTENIDO_REQUERIDO");
  });

  it("una generación ya guardada (con id) se lee sin filtro y sin volver a filtrarse", () => {
    const { filtroContenido, ...guardada } = libre("armas antiguas");
    // Si la lista de términos cambia después, lo ya guardado no puede dejar de leerse
    const g = new Generacion({ ...guardada, id: "g1" });
    assert.equal(g.parametros.tematica, "armas antiguas");
    assert.equal(g.parametros.modoTematica, "libre");
  });

  it("el filtro no queda guardado en la entidad", () => {
    const g = new Generacion(libre("frutas"));
    assert.equal(g.filtroContenido, undefined);
    assert.ok(!JSON.stringify(g).includes("evaluar"));
  });

  it("la temática libre no cambia la deducción de la mecánica", () => {
    assert.equal(new Generacion(libre("frutas")).mecanica, "seleccionar_opcion");
  });
});

describe("Entidad Generacion: filtro de la instrucción del docente (paso 9)", () => {
  // Filtro falso del puerto: bloquea solo la palabra "armas" (el filtro real se prueba con sus propias pruebas)
  const filtro = { evaluar: (texto) => (/armas/i.test(texto) ? { permitido: false, categoria: "armas" } : { permitido: true }) };
  const { mecanica, ...base } = gen.parametros;
  const con = (instruccion, extra = {}) => ({ ...gen, filtroContenido: filtro, parametros: { ...base, instruccion }, ...extra });

  it("una instrucción bloqueada se rechaza con un código propio y sin repetir lo escrito", () => {
    assert.throws(() => new Generacion(con("Practicar con armas")),
      (e) => e instanceof EntradaInvalida && e.codigo === "INSTRUCCION_NO_PERMITIDA" && !/armas/i.test(e.message));
  });

  it("también en modo libre, antes que cualquier otra cosa de la solicitud", () => {
    const libre = { ...con("Practicar con armas"), parametros: { ...base, modoTematica: "libre", tematica: "frutas", instruccion: "Practicar con armas" } };
    assert.throws(() => new Generacion(libre), (e) => e.codigo === "INSTRUCCION_NO_PERMITIDA");
  });

  it("las instrucciones normales pasan, con o sin instrucción", () => {
    for (const ok of ["Practicar especialmente A y E", "usar palabras cortas", "", undefined]) {
      assert.doesNotThrow(() => new Generacion(con(ok)), String(ok));
    }
    assert.equal(new Generacion(con("usar palabras cortas")).parametros.instruccion, "usar palabras cortas");
  });

  it("una generación ya guardada (con id) no se vuelve a filtrar: se puede seguir leyendo", () => {
    assert.doesNotThrow(() => new Generacion(con("Practicar con armas", { id: "g1" })));
  });

  it("sin filtro en modo catálogo no hay qué comprobar (solo la temática libre lo exige)", () => {
    assert.doesNotThrow(() => new Generacion({ ...gen, parametros: { ...base, instruccion: "Practicar con armas" } }));
  });
});

const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../../../Infraestructura/database/baseDePruebas");
const { crearEscenario } = require("../../../Infraestructura/database/fixturesSql");
const { componer } = require("../../../../src/lib/Generacion/Infraestructura/http");
const ConfiguracionGeneracion = require("../../../../src/lib/Generacion/Dominio/Entidades/ConfiguracionGeneracion");
const GeneradorContenidoFalso = require("../../../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const FiltroContenidoJson = require("../../../../src/lib/Juego/Infraestructura/FiltroContenidoJson");
const EmojisPermitidosJson = require("../../../../src/lib/Juego/Infraestructura/EmojisPermitidosJson");
const { crearAsegurarCanales } = require("../../../../src/lib/Canal/Infraestructura/http");
const { periodoDiario } = require("../../../../src/lib/Generacion/Dominio/Entidades/Periodo");

// La temática libre de punta a punta (paso 7) contra PostgreSQL y MongoDB reales. Solo el generador es de prueba:
// el falso de siempre, con el filtro y la lista de iconos reales, sin proveedor ni costo.
const prueba = pruebasConBase("GeneracionLibre", { sql: true, mongo: true });
const filtroContenido = new FiltroContenidoJson();
const emojisPermitidos = new EmojisPermitidosJson();
const falso = new GeneradorContenidoFalso({ filtroContenido, emojisPermitidos });

const config = (extra = {}) => new ConfiguracionGeneracion({
  habilitada: true, libreHabilitada: true, permitirDiez: true, tiempoLimiteMs: 5000, margenConciliacionMs: 0,
  presupuestoMensual: 1e6, costoMaximoLlamada: 1, tarifaEntrada: 1, tarifaSalida: 2, ...extra
});
// `transformar` permite estropear a propósito lo que devuelve el generador
const montar = ({ transformar = (r) => r, ...extra } = {}) => {
  const generador = {
    llamadas: 0, solicitudes: [],
    generar: async (s) => {
      generador.llamadas += 1;
      generador.solicitudes.push(s);
      return transformar({ ...(await falso.generar(s)), uso: { proveedor: "prueba", modelo: "m", tokensEntrada: 1000, tokensSalida: 1000 } });
    }
  };
  return { generador, c: componer({ config: config(extra), generador, filtroContenido, emojisPermitidos }) };
};

let contador = 0;
const clave = () => `clave-libre-${String(++contador).padStart(8, "0")}`;
const libre = (esc, extra = {}) => ({ cursoId: esc.cursoId, estudianteId: esc.estudianteId, habilidad: "vocales", modoTematica: "libre", tematica: "frutas", cantidad: 5, ...extra });
const escenario = async () => {
  await crearAsegurarCanales().ejecutar();
  return crearEscenario();
};
const usado = async (c, docenteId) => {
  const cuota = await c.cuotaRepo.obtener(docenteId, periodoDiario(new Date(), config().zonaHoraria));
  return cuota ? cuota.reservado + cuota.consumido : 0;
};
const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const esperar = async (condicion) => {
  for (let i = 0; i < 600 && !condicion(); i += 1) await dormir(5);
  assert.ok(condicion(), "la condición no se cumplió a tiempo");
};

describe("Generación libre: de la solicitud al borrador", () => {
  prueba("una solicitud libre completa el flujo: borrador de origen IA, versión libre y título del servidor", async () => {
    const esc = await escenario();
    const { c, generador } = montar();
    const { generacion, esNueva } = await c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc, { habilidad: "contar_silabas", tematica: "Sonidos de   animales" }));
    assert.equal(esNueva, true);
    assert.equal(generacion.estado, "completada");
    assert.deepEqual([generacion.parametros.modoTematica, generacion.parametros.tematica], ["libre", "sonidos de animales"]);

    const juego = await c.juegoRepo.findByGeneracionId(generacion.id, esc.docenteId);
    assert.deepEqual([juego.origen, juego.estado, juego.titulo], ["ia", "borrador", "Cuenta las sílabas: sonidos de animales"]);
    const [version] = await c.versionRepo.findByJuego(juego.id);
    assert.deepEqual([version.estado, version.configuracion.modoTematica, version.configuracion.tematica], ["borrador", "libre", "sonidos de animales"]);
    assert.equal(version.ejercicios.length, 5);
    assert.ok(version.ejercicios.every((e) => e.recursoId === undefined), "no depende de recursos del catálogo");
    assert.equal(generador.llamadas, 1);
  });

  prueba("en modo libre no se piden recursos al catálogo; en modo catálogo sí, como antes", async () => {
    const esc = await escenario();
    const { c, generador } = montar();
    await c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc));
    await c.solicitar.ejecutar(esc.docenteId, clave(), { cursoId: esc.cursoId, habilidad: "vocales", tematica: "animales", cantidad: 5 });
    const [deLibre, deCatalogo] = generador.solicitudes;
    assert.deepEqual([deLibre.modoTematica, deLibre.recursos], ["libre", []]);
    assert.equal(deCatalogo.modoTematica, "catalogo");
    assert.ok(deCatalogo.recursos.length > 0);
  });

  prueba("el generador no recibe nada que identifique al docente ni al estudiante", async () => {
    const esc = await escenario();
    const { c, generador } = montar();
    await c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc, { instruccion: "Con cariño" }));
    assert.deepEqual(Object.keys(generador.solicitudes[0]).sort(), ["cantidad", "franjaEdad", "habilidad", "instruccion", "mecanica", "modoTematica", "recursos", "tematica"]);
  });

  prueba("las cuatro habilidades se guardan como borrador libre con 5 y con 10 ejercicios", async () => {
    const esc = await escenario();
    const { c } = montar({ maxDiarias: 100 });
    for (const habilidad of ["vocales", "palabras_silabas", "completar_silaba", "contar_silabas"]) {
      for (const cantidad of [5, 10]) {
        const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc, { habilidad, cantidad, tematica: "colores" }));
        assert.equal(generacion.estado, "completada", `${habilidad} · ${cantidad}: ${generacion.errorCodigo}`);
        const [version] = await c.versionRepo.findByJuego(generacion.juegoId);
        assert.equal(version.ejercicios.length, cantidad);
      }
    }
  });
});

describe("Generación libre: interruptor y filtro antes de reservar cupo", () => {
  prueba("con la temática libre apagada se rechaza (503) sin guardar nada, sin gastar cupo y sin llamar al generador", async () => {
    const esc = await escenario();
    const { c, generador } = montar({ libreHabilitada: false });
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc)),
      (e) => e.statusCode === 503 && e.codigo === "GENERACION_LIBRE_DESHABILITADA");
    assert.deepEqual(await c.repo.findByDocente(esc.docenteId), []);
    assert.equal(await usado(c, esc.docenteId), 0);
    assert.equal(generador.llamadas, 0);
    // el modo catálogo no depende del interruptor
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), { cursoId: esc.cursoId, habilidad: "vocales", tematica: "animales", cantidad: 5 });
    assert.equal(generacion.estado, "completada");
  });

  prueba("con la temática libre encendida pero la IA apagada sigue aplicando GENERACION_DESHABILITADA", async () => {
    const esc = await escenario();
    const { c, generador } = montar({ habilitada: false, libreHabilitada: true });
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc)), (e) => e.statusCode === 503 && e.codigo === "GENERACION_DESHABILITADA");
    assert.equal(await usado(c, esc.docenteId), 0);
    assert.equal(generador.llamadas, 0);
  });

  prueba("una temática bloqueada se rechaza (400) antes de guardar, reservar o llamar, sin repetir el término", async () => {
    const esc = await escenario();
    const { c, generador } = montar();
    for (const tematica of ["pistolas y armas", "p u t a", "drogas"]) {
      await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc, { tematica })),
        (e) => e.statusCode === 400 && e.codigo === "TEMATICA_NO_PERMITIDA" && !/pistola|arma|puta|droga/i.test(e.message), tematica);
    }
    assert.deepEqual(await c.repo.findByDocente(esc.docenteId), []);
    assert.equal(await usado(c, esc.docenteId), 0);
    assert.equal(generador.llamadas, 0);
  });

  prueba("sin el filtro de contenido en la composición, la temática libre no se acepta (falla cerrado)", async () => {
    const esc = await escenario();
    const generador = { generar: async () => assert.fail("no debe llamarse") };
    const c = componer({ config: config(), generador });
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc)), (e) => e.statusCode === 400);
    assert.deepEqual(await c.repo.findByDocente(esc.docenteId), []);
    assert.equal(await usado(c, esc.docenteId), 0);
  });
});

describe("Generación libre: idempotencia y límites", () => {
  prueba("misma clave y mismos datos = la misma generación; otro modo con la misma clave es CLAVE_REUTILIZADA", async () => {
    const esc = await escenario();
    const { c, generador } = montar();
    const k = clave();
    const primera = await c.solicitar.ejecutar(esc.docenteId, k, libre(esc, { tematica: "animales" }));
    const repetida = await c.solicitar.ejecutar(esc.docenteId, k, libre(esc, { tematica: "animales" }));
    assert.deepEqual([repetida.esNueva, repetida.generacion.id], [false, primera.generacion.id]);

    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, k, libre(esc, { tematica: "animales", modoTematica: "catalogo" })), (e) => e.codigo === "CLAVE_REUTILIZADA");
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, k, libre(esc, { tematica: "frutas" })), (e) => e.codigo === "CLAVE_REUTILIZADA");
    assert.equal(generador.llamadas, 1);
    assert.equal(await usado(c, esc.docenteId), 1);
  });

  prueba("la clave de un docente no afecta a otro", async () => {
    const a = await escenario();
    const b = await escenario();
    const { c } = montar();
    const k = clave();
    const ga = await c.solicitar.ejecutar(a.docenteId, k, libre(a));
    const gb = await c.solicitar.ejecutar(b.docenteId, k, libre(b));
    assert.notEqual(ga.generacion.id, gb.generacion.id);
    assert.equal(gb.esNueva, true);
  });

  prueba("el cupo diario cuenta juntas las solicitudes libres y las de catálogo", async () => {
    const esc = await escenario();
    const { c, generador } = montar({ maxDiarias: 3 });
    await c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc));
    await c.solicitar.ejecutar(esc.docenteId, clave(), { cursoId: esc.cursoId, habilidad: "vocales", tematica: "animales", cantidad: 5 });
    await c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc, { tematica: "colores" }));
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc, { tematica: "animales" })), (e) => e.statusCode === 429 && e.codigo === "CUPO_DIARIO_AGOTADO");
    assert.equal(generador.llamadas, 3);
  });

  prueba("una segunda solicitud libre mientras otra se procesa se rechaza (una por docente)", async () => {
    const esc = await escenario();
    let abrir;
    const puerta = new Promise((resolver) => { abrir = resolver; });
    const { c, generador } = montar({ transformar: (r) => r });
    const lento = generador.generar;
    generador.generar = async (s) => { await puerta; return lento(s); };
    const primera = c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc));
    await esperar(() => c.repo.findByDocente(esc.docenteId).then((l) => l.some((g) => g.estado === "procesando")) && true);
    await dormir(50);
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc, { tematica: "colores" })), (e) => e.statusCode === 429 && e.codigo === "GENERACION_EN_CURSO");
    abrir();
    assert.equal((await primera).generacion.estado, "completada");
  });

  prueba("sin presupuesto global se rechaza igual que en el catálogo", async () => {
    const esc = await escenario();
    const sondeo = montar().c;
    const g = await sondeo.cuotaRepo.obtener(undefined, require("../../../../src/lib/Generacion/Dominio/Entidades/Periodo").periodoMensual(new Date(), config().zonaHoraria));
    const base = g ? g.reservado + g.consumido : 0;
    const { c, generador } = montar({ presupuestoMensual: base + 1 });
    assert.equal((await c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc))).generacion.estado, "completada");
    await assert.rejects(c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc, { tematica: "colores" })), (e) => e.statusCode === 429 && e.codigo === "PRESUPUESTO_AGOTADO");
    assert.equal(generador.llamadas, 1);
    assert.equal(await usado(c, esc.docenteId), 1, "se devolvió el cupo diario de la solicitud rechazada");
  });
});

describe("Generación libre: fallos, cancelación y conciliación", () => {
  prueba("un contenido inválido consume cupo, no deja borrador y el error es consultable sin repetir el término bloqueado", async () => {
    const esc = await escenario();
    // Una palabra bloqueada colada en la salida del generador
    const { c } = montar({ transformar: (r) => ({ ...r, ejercicios: r.ejercicios.map((e, i) => (i === 0 ? { ...e, objetivo: "arma" } : e)) }) });
    const { generacion } = await c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc));
    assert.deepEqual([generacion.estado, generacion.errorCodigo, generacion.juegoId], ["fallida", "CONTENIDO_INVALIDO", undefined]);
    assert.equal(await usado(c, esc.docenteId), 1, "el rechazo por contenido sigue consumiendo cupo");
    assert.equal((await c.juegoRepo.findPaginado(esc.docenteId)).total, 0);

    const consultada = await c.obtener.ejecutar(esc.docenteId, generacion.id);
    assert.equal(consultada.errorCodigo, "CONTENIDO_INVALIDO");
    assert.ok(!/arma/i.test(JSON.stringify(consultada)), "lo consultable no repite el término bloqueado");
    assert.ok(!/arma/i.test(JSON.stringify(await c.listar.ejecutar(esc.docenteId, {}))));
  });

  prueba("sin candidatas suficientes el error del generador queda consultable y consume cupo", async () => {
    const esc = await escenario();
    const { c } = montar();
    const ErrorDelGenerador = require("../../../../src/lib/Compartido/Dominio/Errores/ErrorDelGenerador");
    const c2 = componer({
      config: config(), filtroContenido, emojisPermitidos,
      generador: { generar: async () => { throw new ErrorDelGenerador("Solo 1 de 5 ejercicios necesarios pasaron la validación", "GENERADOR_CANDIDATAS_INSUFICIENTES"); } }
    });
    const { generacion } = await c2.solicitar.ejecutar(esc.docenteId, clave(), libre(esc));
    assert.deepEqual([generacion.estado, generacion.errorCodigo], ["fallida", "GENERADOR_CANDIDATAS_INSUFICIENTES"]);
    assert.equal(await usado(c, esc.docenteId), 1);
  });

  prueba("cancelar una generación libre en curso mantiene el cupo y no deja borrador visible", async () => {
    const esc = await escenario();
    let abrir;
    const puerta = new Promise((resolver) => { abrir = resolver; });
    const { c, generador } = montar();
    const rapido = generador.generar;
    generador.generar = async (s) => { await puerta; return rapido(s); };
    const solicitud = c.solicitar.ejecutar(esc.docenteId, clave(), libre(esc));
    let activa;
    await esperar(() => { c.repo.findByDocente(esc.docenteId).then((l) => { activa = l.find((g) => g.estado === "procesando"); }); return activa; });
    await c.cancelar.ejecutar(esc.docenteId, activa.id);
    abrir();
    const { generacion } = await solicitud;
    assert.equal(generacion.estado, "fallida");
    assert.equal(generacion.errorCodigo, "CANCELADA_POR_DOCENTE");
    assert.equal(await usado(c, esc.docenteId), 1, "ya estaba llamando: el cupo se conserva");
    const visibles = (await c.juegoRepo.findPaginado(esc.docenteId)).total;
    assert.equal(visibles, 0, "el borrador de una generación cancelada no queda a la vista");
  });

  prueba("una generación libre vencida se concilia igual que una de catálogo", async () => {
    const esc = await escenario();
    const { c } = montar();
    const Generacion = require("../../../../src/lib/Generacion/Dominio/Entidades/Generacion");
    const canal = await new (require("../../../../src/lib/Canal/Infraestructura/CanalRepositoryMongoose"))().findByCodigo("docente_computador");
    const { generacion } = await c.repo.save(new Generacion({
      docenteId: esc.docenteId, canalId: canal.id, claveSolicitud: clave(), filtroContenido,
      parametros: { cursoId: esc.cursoId, habilidad: "vocales", modoTematica: "libre", tematica: "frutas", cantidad: 5 }
    }));
    const reservada = await c.reservarCupo.ejecutar(generacion);
    await c.repo.marcarProcesando(reservada.id, esc.docenteId);
    const enUnaHora = new Date(Date.now() + 3600_000);
    assert.deepEqual(await c.conciliar.ejecutar({ docenteId: esc.docenteId, ahora: enUnaHora }), { completadas: 0, interrumpidas: 1 });
    const final = await c.obtener.ejecutar(esc.docenteId, generacion.id);
    assert.deepEqual([final.estado, final.parametros.modoTematica], ["interrumpida", "libre"]);
  });

  prueba("el docente solo ve y cancela sus generaciones libres", async () => {
    const a = await escenario();
    const b = await escenario();
    const { c } = montar();
    const { generacion } = await c.solicitar.ejecutar(a.docenteId, clave(), libre(a));
    await assert.rejects(c.obtener.ejecutar(b.docenteId, generacion.id), (e) => e.statusCode === 404);
    await assert.rejects(c.cancelar.ejecutar(b.docenteId, generacion.id), (e) => e.statusCode === 404);
    assert.deepEqual(await c.listar.ejecutar(b.docenteId, {}), []);
  });
});

describe("Generación libre: lo que el cliente necesita saber (cuotas)", () => {
  prueba("las cuotas informan si la temática libre se puede usar: solo con la IA y el interruptor encendidos", async () => {
    const esc = await escenario();
    const informa = async (extra) => (await montar(extra).c.consultarCuotas.ejecutar(esc.docenteId)).generacionLibreHabilitada;
    assert.equal(await informa({}), true);
    assert.equal(await informa({ libreHabilitada: false }), false);
    assert.equal(await informa({ habilitada: false, libreHabilitada: true }), false);
    assert.equal(await informa({ habilitada: false, libreHabilitada: false }), false);
  });
});

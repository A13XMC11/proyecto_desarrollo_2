const { describe } = require("node:test");
const assert = require("node:assert/strict");

// La generación se habilita ANTES de que buildApp lea el entorno. Valores de prueba con el generador falso.
Object.assign(process.env, {
  AI_ENABLED: "true", AI_PROVEEDOR: "falso", GENERADOR_FALSO_DEMORA_MS: "0", AI_MAX_DIARIAS: "3", AI_MAX_SIMULTANEAS: "1",
  AI_TIEMPO_LIMITE_MS: "5000", AI_MARGEN_CONCILIACION_MS: "1000", AI_PRESUPUESTO_MENSUAL: "1000000",
  AI_COSTO_MAXIMO_LLAMADA: "1", AI_TARIFA_ENTRADA_MTOK: "1", AI_TARIFA_SALIDA_MTOK: "2"
});

const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor, registrarDocente } = require("./cliente");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");
const VersionJuego = require("../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const VersionRepositoryMongoose = require("../../src/lib/Juego/Infraestructura/VersionRepositoryMongoose");
const { MECANICAS, actividad } = require("../ayudas/actividadesLibres");

const prueba = pruebasConBase("contenidoLibreHttp", { sql: true, mongo: true });
const llamar = conServidor();
const versiones = new VersionRepositoryMongoose();

async function escenario() {
  await crearAsegurarCanales().ejecutar();
  const docente = await registrarDocente(llamar);
  const ajeno = await registrarDocente(llamar);
  const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } })).cuerpo.id;
  const estudiante = (await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { cursoId: curso, codigoLista: "A01", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
  return { docente, ajeno, curso, estudiante };
}

// Un juego manual y un borrador de temática LIBRE insertado con datos fabricados a mano, sin pasar por la generación
async function juegoConBorradorLibre(esc, habilidad, tema, ejercicios = actividad(habilidad, tema)) {
  const juego = (await llamar("/api/juegos", { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: esc.curso, titulo: `Libre ${tema}`, habilidad } })).cuerpo.id;
  const version = await versiones.save(new VersionJuego({
    juegoId: juego, ejercicios,
    configuracion: { habilidad, mecanica: MECANICAS[habilidad], modoTematica: "libre", tematica: tema, cantidadEjercicios: 5 }
  }));
  return { juego, version: version.id, rutaV: `/api/juegos/${juego}/versiones`, ejercicios };
}

// La opción correcta y una incorrecta de un ejercicio fabricado (la vista del estudiante no las revela)
const correcta = (e) => e.respuestaCorrectaId;
const incorrecta = (e) => e.opciones.find((o) => o.id !== e.respuestaCorrectaId).id;

describe("HTTP: temática libre, de la aprobación a la partida (paso 4, datos fabricados a mano)", () => {
  prueba("una actividad de vocales con frutas se valida, se aprueba y se juega; el servidor corrige", async () => {
    const esc = await escenario();
    const { juego, version, rutaV, ejercicios } = await juegoConBorradorLibre(esc, "vocales", "frutas");

    const borrador = await llamar(`${rutaV}/${version}`, { docente: esc.docente });
    assert.equal(borrador.status, 200);
    assert.deepEqual([borrador.cuerpo.configuracion.modoTematica, borrador.cuerpo.configuracion.tematica, borrador.cuerpo.estado], ["libre", "frutas", "borrador"]);

    const aprobada = await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });
    assert.equal(aprobada.status, 200, JSON.stringify(aprobada.cuerpo));
    assert.equal(aprobada.cuerpo.version.estado, "aprobada");
    assert.equal(aprobada.cuerpo.juego.estado, "listo");
    assert.equal(aprobada.cuerpo.version.configuracion.modoTematica, "libre");

    const partida = await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" } });
    assert.equal(partida.status, 201, JSON.stringify(partida.cuerpo));
    const jugable = (await llamar(`/api/partidas/${partida.cuerpo.id}/jugable`, { docente: esc.docente })).cuerpo;
    assert.equal(jugable.ejercicios.length, 5);
    const texto = JSON.stringify(jugable);
    for (const secreto of ["respuestaCorrectaId", "ordenCorrecto", "palabraId"]) assert.ok(!texto.includes(secreto), `la vista del estudiante no debe incluir ${secreto}`);
    assert.deepEqual(jugable.ejercicios.map((e) => e.objetivo).sort(), ["albaricoque", "aguacate", "arándano", "uva", "uvilla"].sort());

    const intento = (ejercicioId, eleccion, n) => llamar(`/api/partidas/${partida.cuerpo.id}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId, eleccion, operacionId: `op-libre-${n}` } });
    // El estudiante no decide qué es correcto: lo decide el servidor con la versión guardada
    const fallo = await intento("e1", incorrecta(ejercicios[0]), 1);
    assert.equal(fallo.cuerpo.esCorrecto, false);
    const acierto = await intento("e1", correcta(ejercicios[0]), 2);
    assert.equal(acierto.cuerpo.esCorrecto, true);
    for (let i = 1; i < 5; i += 1) assert.equal((await intento(`e${i + 1}`, correcta(ejercicios[i]), 10 + i)).cuerpo.esCorrecto, true);
    const final = (await llamar(`/api/partidas/${partida.cuerpo.id}`, { docente: esc.docente })).cuerpo;
    assert.equal(final.estado, "finalizada");
    assert.equal(final.intentos.length, 6);
  });

  prueba("ordenar sílabas con animales: el servidor corrige el orden y la vista no lo revela", async () => {
    const esc = await escenario();
    const { juego, version, rutaV, ejercicios } = await juegoConBorradorLibre(esc, "palabras_silabas", "animales");
    assert.equal((await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente })).status, 200);
    const partida = await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" } });
    const jugable = (await llamar(`/api/partidas/${partida.cuerpo.id}/jugable`, { docente: esc.docente })).cuerpo;
    assert.ok(!JSON.stringify(jugable).includes("ordenCorrecto"));
    assert.ok(jugable.ejercicios.every((e) => e.tipo === "ordenar_silabas" && e.piezas.length >= 2));

    const e1 = ejercicios[0]; // perro: pe-rro
    const intento = (eleccion, n) => llamar(`/api/partidas/${partida.cuerpo.id}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e1", eleccion, operacionId: `op-orden-${n}` } });
    assert.equal((await intento([...e1.ordenCorrecto].reverse(), 1)).cuerpo.esCorrecto, false);
    assert.equal((await intento(e1.ordenCorrecto, 2)).cuerpo.esCorrecto, true);
  });

  prueba("completar, contar y ordenar con frutas, colores y animales también se aprueban y se juegan", async () => {
    const esc = await escenario();
    for (const [habilidad, tema] of [["completar_silaba", "colores"], ["contar_silabas", "animales"], ["contar_silabas", "frutas"], ["palabras_silabas", "colores"], ["completar_silaba", "frutas"]]) {
      const { juego, version, rutaV, ejercicios } = await juegoConBorradorLibre(esc, habilidad, tema);
      const aprobada = await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });
      assert.equal(aprobada.status, 200, `${habilidad} · ${tema}: ${JSON.stringify(aprobada.cuerpo)}`);
      const partida = await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" } });
      assert.equal(partida.status, 201, `${habilidad} · ${tema}`);
      const eleccion = ejercicios[0].ordenCorrecto || correcta(ejercicios[0]);
      const intento = await llamar(`/api/partidas/${partida.cuerpo.id}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e1", eleccion, operacionId: "op-lote-1" } });
      assert.equal(intento.cuerpo.esCorrecto, true, `${habilidad} · ${tema}`);
      await llamar(`/api/partidas/${partida.cuerpo.id}/abandonar`, { metodo: "POST", docente: esc.docente });
    }
  });

  prueba("una palabra bloqueada por el filtro no se aprueba, y el mensaje no la repite", async () => {
    const esc = await escenario();
    const lista = actividad("vocales", "animales");
    lista[0] = { ...lista[0], objetivo: "arma" };
    const { juego, version, rutaV } = await juegoConBorradorLibre(esc, "vocales", "animales", lista);
    const r = await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });
    assert.equal(r.status, 400);
    assert.equal(r.cuerpo.codigo, "PALABRA_NO_PERMITIDA");
    assert.ok(!/arma/i.test(JSON.stringify(r.cuerpo)), "la respuesta no repite el término bloqueado");
    assert.equal((await llamar(`${rutaV}/${version}`, { docente: esc.docente })).cuerpo.estado, "borrador");
    assert.equal((await llamar(`/api/juegos/${juego}`, { docente: esc.docente })).cuerpo.estado, "borrador");
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" } })).status, 409);
  });

  prueba("un hiato o un icono fuera de lista tampoco se aprueban, con un mensaje claro para el docente", async () => {
    const esc = await escenario();
    const conHiato = actividad("contar_silabas", "animales");
    conHiato[0] = { ...conHiato[0], objetivo: "león" };
    const a = await juegoConBorradorLibre(esc, "contar_silabas", "animales", conHiato);
    const r1 = await llamar(`${a.rutaV}/${a.version}/aprobar`, { metodo: "POST", docente: esc.docente });
    assert.equal(r1.status, 400);
    assert.equal(r1.cuerpo.codigo, "SILABEO_DUDOSO");
    assert.match(r1.cuerpo.mensaje || r1.cuerpo.error || JSON.stringify(r1.cuerpo), /hiato/i);

    const conIcono = actividad("vocales", "frutas");
    conIcono[0] = { ...conIcono[0], icono: "🔪" };
    const b = await juegoConBorradorLibre(esc, "vocales", "frutas", conIcono);
    const r2 = await llamar(`${b.rutaV}/${b.version}/aprobar`, { metodo: "POST", docente: esc.docente });
    assert.equal(r2.status, 400);
    assert.equal(r2.cuerpo.codigo, "ICONO_NO_PERMITIDO");
  });

  prueba("editar un borrador libre vuelve a validar el contenido, y otro docente no puede tocarlo", async () => {
    const esc = await escenario();
    const { version, rutaV } = await juegoConBorradorLibre(esc, "vocales", "frutas");
    const buenos = actividad("vocales", "animales");
    const editado = await llamar(`${rutaV}/${version}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: buenos } });
    assert.equal(editado.status, 200, JSON.stringify(editado.cuerpo));
    assert.equal(editado.cuerpo.configuracion.modoTematica, "libre");

    const malos = actividad("vocales", "animales");
    malos[1] = { ...malos[1], objetivo: "pistola" };
    const rechazado = await llamar(`${rutaV}/${version}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: malos } });
    assert.equal(rechazado.status, 400);
    assert.ok(!/pistola/i.test(JSON.stringify(rechazado.cuerpo)));
    assert.equal((await llamar(`${rutaV}/${version}`, { docente: esc.docente })).cuerpo.ejercicios[1].objetivo, "elefante", "un PUT inválido no cambia lo guardado");

    const extra = await llamar(`${rutaV}/${version}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: [{ ...buenos[0], script: "x" }] } });
    assert.equal(extra.status, 400, "los campos desconocidos se rechazan");
    assert.equal((await llamar(`${rutaV}/${version}`, { metodo: "PUT", docente: esc.ajeno, cuerpo: { ejercicios: buenos } })).status, 404);
    assert.equal((await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.ajeno })).status, 404);
  });

  prueba("la temática libre sigue inalcanzable desde la solicitud de generación", async () => {
    const esc = await escenario();
    const r = await llamar("/api/generaciones", {
      metodo: "POST", docente: esc.docente, cabeceras: { "idempotency-key": "clave-contenido-libre-01" },
      cuerpo: { cursoId: esc.curso, habilidad: "vocales", modoTematica: "libre", tematica: "frutas", cantidad: 5 }
    });
    assert.equal(r.status, 400);
    assert.equal(r.cuerpo.codigo, "TEMATICA_LIBRE_NO_DISPONIBLE");
  });

  prueba("una versión del catálogo se valida y aprueba igual que antes", async () => {
    const esc = await escenario();
    const juego = (await llamar("/api/juegos", { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: esc.curso, titulo: "Catálogo", habilidad: "vocales" } })).cuerpo.id;
    const rutaV = `/api/juegos/${juego}/versiones`;
    const ejerciciosCatalogo = [1, 2, 3, 4, 5].map((n) => ({
      id: `e${n}`, consigna: `¿Con qué vocal empieza esta palabra? (${n})`, recursoId: "abeja",
      opciones: ["a", "e", "i"].map((t) => ({ id: t, texto: t })), respuestaCorrectaId: "a"
    }));
    const v = await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejerciciosCatalogo } });
    assert.equal(v.status, 201, JSON.stringify(v.cuerpo));
    assert.equal(v.cuerpo.configuracion.modoTematica, "catalogo");
    assert.equal((await llamar(`${rutaV}/${v.cuerpo.id}/aprobar`, { metodo: "POST", docente: esc.docente })).status, 200);
  });
});

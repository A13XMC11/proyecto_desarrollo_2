const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor, registrarDocente } = require("./cliente");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");

const prueba = pruebasConBase("crudMongo", { sql: true, mongo: true });
const llamar = conServidor();

// Ejercicios coherentes con el catálogo: e2 se responde con "o" (oso); los demás, con "a" (abeja).
// La consigna lleva el número para que no se repita con la misma respuesta.
const ejercicio = (n) => {
  const vocal = n === 2 ? "o" : "a";
  const otras = ["e", "i"];
  return {
    id: `e${n}`,
    consigna: `¿Con qué vocal empieza esta palabra? (${n})`,
    pista: "Piensa en el sonido",
    recursoId: n === 2 ? "oso" : "abeja",
    opciones: [vocal, ...otras].map((t) => ({ id: t, texto: t })),
    respuestaCorrectaId: vocal
  };
};
const ejercicios = (cantidad) => Array.from({ length: cantidad }, (_, i) => ejercicio(i + 1));

// Docente con curso y estudiante, más un docente ajeno
async function escenario() {
  await crearAsegurarCanales().ejecutar();
  const docente = await registrarDocente(llamar);
  const ajeno = await registrarDocente(llamar);
  const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } })).cuerpo.id;
  const estudiante = (await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { cursoId: curso, codigoLista: "A01", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
  return { docente, ajeno, curso, estudiante };
}

const crearJuego = (esc, extra = {}) =>
  llamar("/api/juegos", { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: esc.curso, titulo: "Las vocales", habilidad: "vocales", ...extra } });

describe("CRUD HTTP sobre MongoDB", () => {
  prueba("juegos: crear, listar, obtener, actualizar, archivar y desarchivar", async () => {
    const esc = await escenario();
    const creado = await crearJuego(esc, { estudianteId: esc.estudiante });
    assert.equal(creado.status, 201);
    assert.equal(creado.cuerpo.mecanica, "seleccionar_opcion");
    const id = creado.cuerpo.id;

    assert.equal((await llamar("/api/juegos", { metodo: "POST", docente: esc.ajeno, cuerpo: { cursoId: esc.curso, titulo: "Robado", habilidad: "vocales" } })).status, 404, "curso ajeno");
    assert.equal((await crearJuego(esc, { titulo: "x" })).status, 400);
    assert.equal((await crearJuego(esc, { habilidad: "otra" })).status, 400);

    const lista = await llamar("/api/juegos", { docente: esc.docente });
    assert.equal(lista.cuerpo.total, 1);
    assert.equal((await llamar("/api/juegos", { docente: esc.ajeno })).cuerpo.total, 0);
    assert.equal((await llamar("/api/juegos?habilidad=palabras_silabas", { docente: esc.docente })).cuerpo.total, 0);
    assert.equal((await llamar("/api/juegos?texto=vocal", { docente: esc.docente })).cuerpo.total, 1);
    assert.equal((await llamar("/api/juegos?estado[$ne]=x", { docente: esc.docente })).status, 200, "los filtros no aceptan operadores");

    assert.equal((await llamar(`/api/juegos/${id}`, { docente: esc.docente })).cuerpo.titulo, "Las vocales");
    assert.equal((await llamar(`/api/juegos/${id}`, { docente: esc.ajeno })).status, 404);
    assert.equal((await llamar("/api/juegos/no-es-id", { docente: esc.docente })).status, 404);

    const editado = await llamar(`/api/juegos/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { titulo: "Vocales del 1.º", estado: "listo" } });
    assert.equal(editado.cuerpo.titulo, "Vocales del 1.º");
    assert.equal(editado.cuerpo.estado, "borrador", "el estado no se edita por PUT");
    assert.equal((await llamar(`/api/juegos/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { titulo: "x" } })).status, 400);
    assert.equal((await llamar(`/api/juegos/${id}`, { metodo: "PUT", docente: esc.ajeno, cuerpo: { titulo: "Hack hack" } })).status, 404);

    assert.equal((await llamar(`/api/juegos/${id}`, { metodo: "DELETE", docente: esc.ajeno })).status, 404);
    assert.equal((await llamar(`/api/juegos/${id}`, { metodo: "DELETE", docente: esc.docente })).status, 204);
    assert.equal((await llamar(`/api/juegos/${id}`, { docente: esc.docente })).cuerpo.estado, "archivado");
    assert.equal((await llamar(`/api/juegos/${id}`, { metodo: "DELETE", docente: esc.docente })).status, 409, "ya archivado");
    assert.equal((await llamar("/api/juegos", { docente: esc.docente })).cuerpo.total, 0);
    assert.equal((await llamar("/api/juegos?incluirArchivados=true", { docente: esc.docente })).cuerpo.total, 1);

    const restaurado = await llamar(`/api/juegos/${id}/desarchivar`, { metodo: "POST", docente: esc.docente });
    assert.equal(restaurado.cuerpo.estado, "borrador");
    assert.equal((await llamar(`/api/juegos/${id}/desarchivar`, { metodo: "POST", docente: esc.docente })).status, 409);
  });

  prueba("versiones: crear borrador, editar, aprobar (inmutable) y descartar", async () => {
    const esc = await escenario();
    const juego = (await crearJuego(esc)).cuerpo.id;
    const ruta = `/api/juegos/${juego}/versiones`;
    const config = { tematica: "animales", cantidadEjercicios: 5 };

    assert.equal((await llamar(ruta, { metodo: "POST", docente: esc.ajeno, cuerpo: { ...config, ejercicios: ejercicios(2) } })).status, 404, "juego ajeno");
    assert.equal((await llamar(ruta, { metodo: "POST", docente: esc.docente, cuerpo: { ...config, ejercicios: [{ id: "e1", consigna: "x" }] } })).status, 400);
    const creada = await llamar(ruta, { metodo: "POST", docente: esc.docente, cuerpo: { ...config, ejercicios: ejercicios(2) } });
    assert.equal(creada.status, 201);
    assert.equal(creada.cuerpo.numero, 1);
    assert.equal(creada.cuerpo.estado, "borrador");
    assert.equal(creada.cuerpo.configuracion.mecanica, "seleccionar_opcion", "la mecánica sale del juego");
    const id = creada.cuerpo.id;
    assert.equal((await llamar(ruta, { metodo: "POST", docente: esc.docente, cuerpo: { ...config, ejercicios: ejercicios(1) } })).status, 409, "un solo borrador activo");

    assert.equal((await llamar(ruta, { docente: esc.docente })).cuerpo.length, 1);
    assert.equal((await llamar(ruta, { docente: esc.ajeno })).status, 404);
    assert.equal((await llamar(`${ruta}/${id}`, { docente: esc.docente })).cuerpo.ejercicios.length, 2);
    assert.equal((await llamar(`${ruta}/${id}`, { docente: esc.ajeno })).status, 404);

    assert.equal((await llamar(`${ruta}/${id}/aprobar`, { metodo: "POST", docente: esc.docente })).status, 400, "incompleta: faltan ejercicios");
    assert.equal((await llamar(`${ruta}/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: ejercicios(6) } })).status, 400, "más de los configurados");
    for (const cuerpo of [{}, { ejercicio: ejercicios(5) }, { ejercicios: [null] }, { ejercicios: "no-es-lista" }]) {
      assert.equal((await llamar(`${ruta}/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo })).status, 400, JSON.stringify(cuerpo));
    }
    assert.equal((await llamar(`${ruta}/${id}`, { docente: esc.docente })).cuerpo.ejercicios.length, 2, "un PUT inválido no borra los ejercicios");
    const editada = await llamar(`${ruta}/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: ejercicios(5) } });
    assert.equal(editada.cuerpo.ejercicios.length, 5);

    assert.equal((await llamar(`${ruta}/${id}/aprobar`, { metodo: "POST", docente: esc.ajeno })).status, 404);
    const aprobada = await llamar(`${ruta}/${id}/aprobar`, { metodo: "POST", docente: esc.docente });
    assert.equal(aprobada.status, 200);
    assert.equal(aprobada.cuerpo.version.estado, "aprobada");
    assert.equal(aprobada.cuerpo.juego.estado, "listo");
    assert.equal(aprobada.cuerpo.juego.versionActualId, id);

    assert.equal((await llamar(`${ruta}/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: ejercicios(5) } })).status, 409, "una aprobada es inmutable");
    assert.equal((await llamar(`${ruta}/${id}/aprobar`, { metodo: "POST", docente: esc.docente })).status, 409);
    assert.equal((await llamar(`${ruta}/${id}`, { metodo: "DELETE", docente: esc.docente })).status, 409, "una aprobada no se descarta");

    const nueva = await llamar(ruta, { metodo: "POST", docente: esc.docente, cuerpo: { ...config, ejercicios: ejercicios(1) } });
    assert.equal(nueva.cuerpo.numero, 2, "tras aprobar se puede abrir otra versión");
    assert.equal((await llamar(`${ruta}/${nueva.cuerpo.id}`, { metodo: "DELETE", docente: esc.ajeno })).status, 404);
    assert.equal((await llamar(`${ruta}/${nueva.cuerpo.id}`, { metodo: "DELETE", docente: esc.docente })).status, 204);
    assert.equal((await llamar(`${ruta}/${nueva.cuerpo.id}`, { docente: esc.docente })).cuerpo.estado, "descartada");
  });

  prueba("catálogo: solo se listan recursos a docentes autenticados, filtrables por temática", async () => {
    const esc = await escenario();
    assert.equal((await llamar("/api/recursos")).status, 401);
    const todos = await llamar("/api/recursos", { docente: esc.docente });
    assert.equal(todos.status, 200);
    assert.ok(todos.cuerpo.length >= 15);
    assert.ok(todos.cuerpo.every((r) => r.id && r.palabra && r.tematica && Array.isArray(r.silabas)));
    const animales = await llamar("/api/recursos?tematica=animales", { docente: esc.docente });
    assert.ok(animales.cuerpo.length > 0 && animales.cuerpo.every((r) => r.tematica === "animales"));
    assert.equal((await llamar("/api/recursos?tematica=espacio", { docente: esc.docente })).status, 400);
  });

  prueba("contenido: el servidor rechaza lo que no sale del catálogo, al crear, al editar y al aprobar", async () => {
    const esc = await escenario();
    const juego = (await crearJuego(esc)).cuerpo.id;
    const ruta = `/api/juegos/${juego}/versiones`;
    const config = { tematica: "animales", cantidadEjercicios: 5 };
    const crear = (ejercicios) => llamar(ruta, { metodo: "POST", docente: esc.docente, cuerpo: { ...config, ejercicios } });

    const inexistente = await crear([{ ...ejercicio(1), recursoId: "fantasma" }]);
    assert.equal(inexistente.status, 400);
    assert.match(inexistente.cuerpo.error?.mensaje || inexistente.cuerpo.mensaje || JSON.stringify(inexistente.cuerpo), /catálogo/);
    assert.equal((await crear([{ ...ejercicio(1), recursoId: "uva" }])).status, 400, "recurso de otra temática");
    assert.equal((await crear([{ ...ejercicio(1), respuestaCorrectaId: "e" }])).status, 400, "la respuesta no es la vocal inicial");
    assert.equal((await crear([{ ...ejercicio(1), extra: "x" }])).status, 400, "campo desconocido");
    assert.equal((await crear([{ ...ejercicio(1), consigna: "¿Con qué vocal empieza abeja?" }])).status, 400, "la consigna revela la palabra");
    assert.equal((await llamar(ruta, { docente: esc.docente })).cuerpo.length, 0, "ningún rechazo dejó un borrador");

    const borrador = await crear(ejercicios(2));
    assert.equal(borrador.status, 201);
    const id = borrador.cuerpo.id;
    const mala = await llamar(`${ruta}/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: [{ ...ejercicio(1), recursoId: "fantasma" }] } });
    assert.equal(mala.status, 400);
    assert.equal((await llamar(`${ruta}/${id}`, { docente: esc.docente })).cuerpo.ejercicios.length, 2, "una edición rechazada no altera el borrador");
    assert.equal((await llamar(`${ruta}/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: [ejercicio(1), ejercicio(1)] } })).status, 400, "ids repetidos");

    // Lo que devuelve la API debe poder reenviarse tal cual (así lo hace "Nueva versión" en el cliente)
    assert.equal((await llamar(`${ruta}/${id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: ejercicios(5) } })).status, 200);
    assert.equal((await llamar(`${ruta}/${id}/aprobar`, { metodo: "POST", docente: esc.docente })).status, 200);
    const aprobada = (await llamar(`${ruta}/${id}`, { docente: esc.docente })).cuerpo;
    const copia = await llamar(ruta, { metodo: "POST", docente: esc.docente, cuerpo: { ...config, ejercicios: aprobada.ejercicios } });
    assert.equal(copia.status, 201, JSON.stringify(copia.cuerpo));
    assert.equal(copia.cuerpo.ejercicios.length, 5);
    const reenviada = await llamar(`${ruta}/${copia.cuerpo.id}`, { metodo: "PUT", docente: esc.docente, cuerpo: { ejercicios: copia.cuerpo.ejercicios } });
    assert.equal(reenviada.status, 200, JSON.stringify(reenviada.cuerpo));
    assert.equal((await llamar(`${ruta}/${copia.cuerpo.id}/aprobar`, { metodo: "POST", docente: esc.docente })).status, 200);

    const diez = await llamar(ruta, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 10, ejercicios: [] } });
    assert.equal(diez.status, 400, "10 ejercicios no están habilitados");
    assert.match(JSON.stringify(diez.cuerpo), /10 ejercicios/);
  });

  prueba("partidas: iniciar, pistas, intentos evaluados en el servidor, finalizar y abandonar", async () => {
    const esc = await escenario();
    const juego = (await crearJuego(esc)).cuerpo.id;
    const rutaV = `/api/juegos/${juego}/versiones`;
    const datos = { estudianteId: esc.estudiante, juegoId: juego };

    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: datos })).status, 409, "el juego aún no tiene versión aprobada");
    const version = (await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejercicios(5) } })).cuerpo.id;
    await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });

    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.ajeno, cuerpo: datos })).status, 404, "juego ajeno");
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { ...datos, canal: "otro" } })).status, 400);
    const iniciada = await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: datos });
    assert.equal(iniciada.status, 201);
    assert.equal(iniciada.cuerpo.estado, "en_curso");
    assert.equal(iniciada.cuerpo.versionId, version);
    const id = iniciada.cuerpo.id;
    const ruta = `/api/partidas/${id}`;
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: datos })).status, 409, "una sola partida en curso");

    const intento = (cuerpo, docente = esc.docente) => llamar(`${ruta}/intentos`, { metodo: "POST", docente, cuerpo });

    // ejercicio 1: pista, un error y un acierto
    const pista = await llamar(`${ruta}/pistas`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e1", operacionId: "p-1" } });
    assert.equal(pista.cuerpo.pista, "Piensa en el sonido");
    assert.equal((await llamar(`${ruta}/pistas`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e1", operacionId: "p-1" } })).status, 200, "pista idempotente");
    assert.equal((await llamar(`${ruta}/pistas`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e3", operacionId: "p-2" } })).status, 409, "no es el ejercicio actual");

    const fallo = await intento({ ejercicioId: "e1", eleccion: "e", operacionId: "op-1" });
    assert.deepEqual({ ok: fallo.cuerpo.esCorrecto, n: fallo.cuerpo.numeroIntento, actual: fallo.cuerpo.ejercicioActual }, { ok: false, n: 1, actual: 0 });
    const repetido = await intento({ ejercicioId: "e1", eleccion: "a", operacionId: "op-1" });
    assert.equal(repetido.cuerpo.esCorrecto, false, "el reenvío devuelve el resultado original, sin recalcular");
    assert.equal((await llamar(ruta, { docente: esc.docente })).cuerpo.intentos.length, 1);

    assert.equal((await intento({ ejercicioId: "e1", eleccion: "a", operacionId: "op-2" }, esc.ajeno)).status, 404);
    assert.equal((await intento({ ejercicioId: "inexistente", eleccion: "a", operacionId: "op-x" })).status, 400);
    assert.equal((await intento({ ejercicioId: "e2", eleccion: "a", operacionId: "op-y" })).status, 409, "no es el ejercicio actual");
    assert.equal((await intento({ ejercicioId: "e1", eleccion: 5, operacionId: "op-z" })).status, 400);

    const acierto = await intento({ ejercicioId: "e1", eleccion: "a", operacionId: "op-3" });
    assert.deepEqual({ ok: acierto.cuerpo.esCorrecto, n: acierto.cuerpo.numeroIntento, actual: acierto.cuerpo.ejercicioActual }, { ok: true, n: 2, actual: 1 });

    // ejercicio 2: dos errores agotan los intentos y se avanza
    await intento({ ejercicioId: "e2", eleccion: "i", operacionId: "op-4" });
    const agotado = await intento({ ejercicioId: "e2", eleccion: "e", operacionId: "op-5" });
    assert.deepEqual({ ok: agotado.cuerpo.esCorrecto, actual: agotado.cuerpo.ejercicioActual }, { ok: false, actual: 2 });

    // ejercicios 3 a 5 correctos: la partida termina sola
    await intento({ ejercicioId: "e3", eleccion: "a", operacionId: "op-6" });
    await intento({ ejercicioId: "e4", eleccion: "a", operacionId: "op-7" });
    const ultimo = await intento({ ejercicioId: "e5", eleccion: "a", operacionId: "op-8" });
    assert.equal(ultimo.cuerpo.terminada, true);
    const final = (await llamar(ruta, { docente: esc.docente })).cuerpo;
    assert.equal(final.estado, "finalizada");
    assert.equal(final.intentos.length, 7, "2 en e1, 2 en e2 y 1 en cada uno de e3, e4 y e5");
    assert.equal(final.intentos[0].usoPista, true, "los intentos de e1 posteriores a la pista lo registran");
    assert.equal(final.intentos[2].usoPista, false, "e2 no pidió pista");

    assert.equal((await intento({ ejercicioId: "e5", eleccion: "a", operacionId: "op-9" })).status, 409, "partida terminada");
    assert.equal((await llamar(`${ruta}/finalizar`, { metodo: "POST", docente: esc.docente })).status, 409);
    assert.equal((await llamar(ruta, { metodo: "DELETE", docente: esc.docente })).status, 409, "no se abandona una terminada");

    assert.equal((await llamar("/api/partidas", { docente: esc.docente })).cuerpo.length, 1);
    assert.equal((await llamar(`/api/partidas?estudianteId=${esc.estudiante}&habilidad=vocales&estado=finalizada`, { docente: esc.docente })).cuerpo.length, 1);
    assert.equal((await llamar("/api/partidas?estado=en_curso", { docente: esc.docente })).cuerpo.length, 0);
    assert.equal((await llamar("/api/partidas?desde=no-es-fecha", { docente: esc.docente })).status, 400);
    assert.equal((await llamar("/api/partidas?desde=2020-01-01&hasta=2100-01-01", { docente: esc.docente })).cuerpo.length, 1);
    assert.equal((await llamar("/api/partidas", { docente: esc.ajeno })).cuerpo.length, 0);
    assert.equal((await llamar(ruta, { docente: esc.ajeno })).status, 404);

    // otra partida: finalizar a mano y abandonar
    const segunda = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: datos })).cuerpo.id;
    assert.equal((await llamar(`/api/partidas/${segunda}/finalizar`, { metodo: "POST", docente: esc.docente })).cuerpo.estado, "finalizada");
    const tercera = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: datos })).cuerpo.id;
    assert.equal((await llamar(`/api/partidas/${tercera}`, { metodo: "DELETE", docente: esc.ajeno })).status, 404);
    assert.equal((await llamar(`/api/partidas/${tercera}`, { metodo: "DELETE", docente: esc.docente })).status, 204);
    assert.equal((await llamar(`/api/partidas/${tercera}`, { docente: esc.docente })).cuerpo.estado, "abandonada");
  });

  prueba("partidas: intentos simultáneos no numeran igual ni superan el límite", async () => {
    const esc = await escenario();
    const juego = (await crearJuego(esc)).cuerpo.id;
    const rutaV = `/api/juegos/${juego}/versiones`;
    const version = (await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejercicios(5) } })).cuerpo.id;
    await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });
    const partida = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { juegoId: juego, estudianteId: esc.estudiante } })).cuerpo.id;

    // 6 peticiones simultáneas con operaciones distintas sobre el mismo ejercicio (todas incorrectas)
    const respuestas = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        llamar(`/api/partidas/${partida}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e1", eleccion: "e", operacionId: `par-${i}` } })
      )
    );
    const aceptadas = respuestas.filter((r) => r.status === 200);
    assert.ok(aceptadas.length >= 1 && aceptadas.length <= 2, `se aceptaron ${aceptadas.length}`);
    assert.ok(respuestas.filter((r) => r.status !== 200).every((r) => [409, 429].includes(r.status)));
    const guardados = (await llamar(`/api/partidas/${partida}`, { docente: esc.docente })).cuerpo.intentos;
    assert.equal(guardados.length, aceptadas.length);
    assert.deepEqual(guardados.map((i) => i.numeroIntento).sort(), aceptadas.map((_, i) => i + 1), "numeración consecutiva sin repetidos");
  });

  prueba("partidas: reglas de inicio (estudiante de otro curso, archivado o inexistente)", async () => {
    const esc = await escenario();
    const juego = (await crearJuego(esc)).cuerpo.id;
    const rutaV = `/api/juegos/${juego}/versiones`;
    const version = (await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejercicios(5) } })).cuerpo.id;
    await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });

    const otroCurso = (await llamar("/api/cursos", { metodo: "POST", docente: esc.docente, cuerpo: { grado: "2.º EGB", paralelo: "B", anioLectivo: "2026-2027" } })).cuerpo.id;
    const deOtroCurso = (await llamar("/api/estudiantes", { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: otroCurso, codigoLista: "B01", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { juegoId: juego, estudianteId: deOtroCurso } })).status, 400);
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { juegoId: juego, estudianteId: "123e4567-e89b-42d3-a456-426614174000" } })).status, 404);

    await llamar(`/api/estudiantes/${esc.estudiante}`, { metodo: "DELETE", docente: esc.docente });
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { juegoId: juego, estudianteId: esc.estudiante } })).status, 409, "estudiante archivado");

    await llamar(`/api/juegos/${juego}`, { metodo: "DELETE", docente: esc.docente });
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { juegoId: juego, estudianteId: deOtroCurso } })).status, 409, "juego archivado");
  });

  prueba("canales (solo lectura) e interacciones (append-only)", async () => {
    const esc = await escenario();
    const lista = await llamar("/api/canales");
    assert.equal(lista.cuerpo.length, 4);
    assert.equal((await llamar("/api/canales/aula_tableta")).cuerpo.dispositivo, "tableta");
    assert.equal((await llamar("/api/canales/otro")).status, 404);
    assert.equal((await llamar("/api/canales", { metodo: "POST", cuerpo: {} })).status, 404, "el catálogo no se modifica");

    const juego = (await crearJuego(esc)).cuerpo.id;
    const rutaV = `/api/juegos/${juego}/versiones`;
    const version = (await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejercicios(5) } })).cuerpo.id;
    await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });
    const partida = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { juegoId: juego, estudianteId: esc.estudiante } })).cuerpo.id;

    const evento = { sesionId: partida, canal: "aula_tableta", tipo: "inicio_partida", operacionId: "ev-1" };
    const creada = await llamar("/api/interacciones", { metodo: "POST", docente: esc.docente, cuerpo: evento });
    assert.equal(creada.status, 201);
    const repetida = await llamar("/api/interacciones", { metodo: "POST", docente: esc.docente, cuerpo: evento });
    assert.equal(repetida.status, 200, "idempotente por (sesión, operación, tipo)");
    assert.equal(repetida.cuerpo.id, creada.cuerpo.id);
    assert.equal((await llamar("/api/interacciones", { metodo: "POST", docente: esc.docente, cuerpo: { ...evento, tipo: "pista" } })).status, 201);

    assert.equal((await llamar("/api/interacciones", { metodo: "POST", docente: esc.docente, cuerpo: { ...evento, canal: "otro" } })).status, 400);
    assert.equal((await llamar("/api/interacciones", { metodo: "POST", docente: esc.docente, cuerpo: { ...evento, tipo: "inventado" } })).status, 400);
    assert.equal((await llamar("/api/interacciones", { metodo: "POST", docente: esc.ajeno, cuerpo: evento })).status, 404, "partida ajena");
    assert.equal((await llamar("/api/interacciones", { metodo: "POST", docente: esc.docente, cuerpo: { canal: "aula_tableta", tipo: "consulta_resultados" } })).status, 201, "sin partida");

    assert.equal((await llamar(`/api/interacciones?sesionId=${partida}`, { docente: esc.docente })).cuerpo.length, 2);
    assert.equal((await llamar(`/api/interacciones?sesionId=${partida}`, { docente: esc.ajeno })).status, 404);
    assert.equal((await llamar("/api/interacciones", { docente: esc.docente })).status, 404, "falta la partida");
    assert.equal((await llamar(`/api/interacciones/${creada.cuerpo.id}`, { metodo: "DELETE", docente: esc.docente })).status, 404, "no se elimina");
  });

  prueba("resultados e inicio: calculados en el servidor, solo con partidas propias", async () => {
    const esc = await escenario();
    const juego = (await crearJuego(esc)).cuerpo.id;
    const rutaV = `/api/juegos/${juego}/versiones`;
    const version = (await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejercicios(5) } })).cuerpo.id;
    await llamar(`${rutaV}/${version}/aprobar`, { metodo: "POST", docente: esc.docente });

    // Partida terminada: e1 bien al primer intento, e2 mal y luego bien con pista
    const partida = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego } })).cuerpo.id;
    const ruta = `/api/partidas/${partida}`;
    await llamar(`${ruta}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e1", eleccion: "a", operacionId: "res-1" } });
    await llamar(`${ruta}/pistas`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e2", operacionId: "res-2" } });
    await llamar(`${ruta}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e2", eleccion: "a", operacionId: "res-3" } });
    await llamar(`${ruta}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e2", eleccion: "o", operacionId: "res-4" } });
    assert.equal((await llamar(`${ruta}/finalizar`, { metodo: "POST", docente: esc.docente })).status, 200);

    const r = await llamar(`/api/resultados?cursoId=${esc.curso}`, { docente: esc.docente });
    assert.equal(r.status, 200);
    assert.deepEqual(
      [r.cuerpo.resumen.partidas, r.cuerpo.resumen.respondidos, r.cuerpo.resumen.primerIntento, r.cuerpo.resumen.sinAyuda, r.cuerpo.resumen.completados, r.cuerpo.resumen.disponibles],
      [1, 2, 1, 1, 2, 5]
    );
    assert.equal(r.cuerpo.partidas[0].titulo, "Las vocales");
    assert.equal(r.cuerpo.porHabilidad[0].habilidad, "vocales");
    assert.equal((await llamar(`/api/resultados?juegoId=${juego}`, { docente: esc.docente })).cuerpo.partidas.length, 1);
    assert.equal((await llamar(`/api/resultados?habilidad=palabras_silabas`, { docente: esc.docente })).cuerpo.partidas.length, 0);
    assert.equal((await llamar(`/api/resultados?habilidad=otra`, { docente: esc.docente })).status, 400);
    assert.equal((await llamar(`/api/resultados?cursoId[$ne]=x`, { docente: esc.docente })).status, 200, "los filtros no aceptan operadores");
    assert.equal((await llamar("/api/resultados", { docente: esc.ajeno })).cuerpo.partidas.length, 0, "otro docente no ve estos resultados");

    const inicio = await llamar("/api/inicio", { docente: esc.docente });
    assert.equal(inicio.status, 200);
    assert.equal(inicio.cuerpo.cursosActivos, 1);
    assert.equal(inicio.cuerpo.actividades.total, 1);
    assert.equal(inicio.cuerpo.enCurso.total, 0);
    assert.equal(inicio.cuerpo.terminadasSemana, 1);
    assert.equal((await llamar("/api/inicio")).status, 401);
  });

  // Demostración del sprint 5 (§14): versión 2, partidas anteriores intactas, filtros y archivo
  prueba("versiones y biblioteca: una versión nueva no cambia lo ya jugado; archivar preserva resultados", async () => {
    const esc = await escenario();
    const juego = (await crearJuego(esc, { titulo: "Las vocales de los animales" })).cuerpo.id;
    const rutaV = `/api/juegos/${juego}/versiones`;
    const v1 = (await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejercicios(5) } })).cuerpo.id;
    await llamar(`${rutaV}/${v1}/aprobar`, { metodo: "POST", docente: esc.docente });
    const consignaV1 = ejercicio(1).consigna;

    // Partida A con la versión 1: se completa y se termina
    const a = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego } })).cuerpo;
    assert.equal(a.versionId, v1);
    await llamar(`/api/partidas/${a.id}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e1", eleccion: "a", operacionId: "ver-1" } });
    await llamar(`/api/partidas/${a.id}/finalizar`, { metodo: "POST", docente: esc.docente });

    // Versión 2: se edita la consigna del primer ejercicio y se aprueba
    const editados = ejercicios(5).map((e) => (e.id === "e1" ? { ...e, consigna: "Mira la imagen y elige su primera vocal" } : e));
    const v2 = (await llamar(rutaV, { metodo: "POST", docente: esc.docente, cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: editados } })).cuerpo;
    assert.equal(v2.numero, 2);
    assert.equal((await llamar(`${rutaV}/${v2.id}/aprobar`, { metodo: "POST", docente: esc.docente })).status, 200);
    assert.equal((await llamar(`/api/juegos/${juego}`, { docente: esc.docente })).cuerpo.versionActualId, v2.id, "la vigente es la 2");

    // La versión 1 y la partida A no cambian
    const versionUno = (await llamar(`${rutaV}/${v1}`, { docente: esc.docente })).cuerpo;
    assert.equal(versionUno.estado, "aprobada");
    assert.equal(versionUno.ejercicios[0].consigna, consignaV1);
    const jugadaA = (await llamar(`/api/partidas/${a.id}/jugable`, { docente: esc.docente })).cuerpo;
    assert.equal(jugadaA.ejercicios[0].consigna, consignaV1, "la partida anterior conserva sus preguntas");
    assert.equal(jugadaA.ejercicios[0].acertado, true, "y su resultado");

    // Una partida nueva usa el contenido actualizado
    const b = (await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego } })).cuerpo;
    assert.equal(b.versionId, v2.id);
    assert.equal((await llamar(`/api/partidas/${b.id}/jugable`, { docente: esc.docente })).cuerpo.ejercicios[0].consigna, "Mira la imagen y elige su primera vocal");

    // Biblioteca: búsqueda y filtros por curso, estudiante, habilidad y estado
    const otro = (await crearJuego(esc, { titulo: "Sílabas para Luis", habilidad: "palabras_silabas", estudianteId: esc.estudiante })).cuerpo.id;
    const lista = async (consulta) => (await llamar(`/api/juegos?${consulta}`, { docente: esc.docente })).cuerpo.items.map((j) => j.id);
    assert.deepEqual(await lista("texto=animales"), [juego]);
    assert.deepEqual(await lista(`cursoId=${esc.curso}&habilidad=palabras_silabas`), [otro]);
    assert.deepEqual(await lista(`estudianteId=${esc.estudiante}`), [otro]);
    assert.deepEqual(await lista("estado=listo"), [juego]);
    assert.deepEqual(await lista("estado=borrador"), [otro]);

    // Archivar: no se inician partidas nuevas, la que estaba en curso se puede terminar y los resultados quedan
    assert.equal((await llamar(`/api/juegos/${juego}`, { metodo: "DELETE", docente: esc.docente })).status, 204);
    assert.ok(!(await lista("")).includes(juego), "sale de la biblioteca activa");
    assert.deepEqual(await lista("estado=archivado&incluirArchivados=true"), [juego]);
    assert.equal((await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego } })).status, 409);
    const intentoB = await llamar(`/api/partidas/${b.id}/intentos`, { metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: "e1", eleccion: "a", operacionId: "ver-2" } });
    assert.equal(intentoB.status, 200, "la partida ya iniciada se puede terminar");
    const resultados = (await llamar(`/api/resultados?juegoId=${juego}`, { docente: esc.docente })).cuerpo;
    assert.equal(resultados.partidas.length, 2, "los resultados se conservan");
  });
});

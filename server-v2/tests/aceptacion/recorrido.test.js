// Pruebas de aceptación del sprint 6 (S6-01): recorren el producto como lo haría una persona docente y comprueban los
// criterios de cierre del plan (§15) que se pueden demostrar de forma automática. Cada prueba lleva el criterio
// que cubre en su nombre. Contra PostgreSQL y MongoDB reales de pruebas.
const { describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Se fijan antes de construir la app: el reinicio necesita el MISMO secreto de sesión, y la IA debe estar apagada
process.env.SESSION_SECRET = "secreto-de-aceptacion-solo-para-pruebas";
process.env.AI_ENABLED = "false";
process.env.NODE_ENV = "test";

const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");
const { levantarServidor, crearNavegador, registrarDocente, prepararAula } = require("./ayudas");
const { ejerciciosVocales, ejerciciosSilabas, eleccionCorrecta, eleccionIncorrecta } = require("../../scripts/contenidoFicticio");

const prueba = pruebasConBase("Aceptacion", { sql: true, mongo: true });

let servidor;
before(async () => {
  servidor = await levantarServidor();
});
after(async () => {
  await servidor.cerrar();
});

let operacion = 0;
const op = () => `acept-${Date.now()}-${++operacion}`;
const responder = (nav, partida, ejercicio, eleccion) =>
  nav.llamar(`/api/partidas/${partida}/intentos`, { metodo: "POST", cuerpo: { ejercicioId: ejercicio.id, eleccion, operacionId: op() } });

async function docenteConAula(opciones) {
  await crearAsegurarCanales().ejecutar();
  const nav = crearNavegador(servidor);
  const id = await registrarDocente(nav);
  const aula = await prepararAula(nav, opciones);
  return { nav, id, aula };
}

describe("Aceptación del sprint 6", () => {
  prueba("recorrido completo: crear actividad, aprobarla, jugarla en el aula y ver los resultados (HU-15)", async () => {
    const ejercicios = ejerciciosVocales();
    const { nav, aula } = await docenteConAula({ ejercicios });

    // El docente encuentra su actividad en la biblioteca, lista para jugar
    const biblioteca = await nav.llamar("/api/juegos");
    assert.equal(biblioteca.cuerpo.total, 1);
    assert.equal(biblioteca.cuerpo.items[0].estado, "listo");

    // Un estudiante juega la partida completa, acertando todo
    const inicio = await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[0], juegoId: aula.juego } });
    assert.equal(inicio.status, 201);
    const partida = inicio.cuerpo.id;
    for (const ejercicio of ejercicios) {
      assert.equal((await responder(nav, partida, ejercicio, eleccionCorrecta(ejercicio))).cuerpo.esCorrecto, true);
    }
    assert.equal((await nav.llamar(`/api/partidas/${partida}`)).cuerpo.estado, "finalizada", "la partida termina sola al responder el último ejercicio");

    // Los resultados lo reflejan, por estudiante y por habilidad, y el inicio resume la semana
    const resultados = (await nav.llamar("/api/resultados")).cuerpo;
    assert.deepEqual([resultados.resumen.partidas, resultados.resumen.primerIntento, resultados.resumen.respondidos], [1, 5, 5]);
    assert.equal(resultados.porEstudiante.length, 1);
    assert.equal(resultados.porHabilidad[0].habilidad, "vocales");
    const inicioDocente = (await nav.llamar("/api/inicio")).cuerpo;
    assert.deepEqual([inicioDocente.cursosActivos, inicioDocente.terminadasSemana], [1, 1]);
  });

  prueba("la mecánica de sílabas también se juega de punta a punta", async () => {
    const ejercicios = ejerciciosSilabas();
    const { nav, aula } = await docenteConAula({ habilidad: "palabras_silabas", ejercicios });
    const partida = (await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[0], juegoId: aula.juego } })).cuerpo.id;
    // Un orden incorrecto no cuenta; luego el correcto sí
    assert.equal((await responder(nav, partida, ejercicios[0], eleccionIncorrecta(ejercicios[0]))).cuerpo.esCorrecto, false);
    for (const ejercicio of ejercicios) await responder(nav, partida, ejercicio, eleccionCorrecta(ejercicio));
    assert.equal((await nav.llamar(`/api/partidas/${partida}`)).cuerpo.estado, "finalizada");
  });

  prueba("versiones aprobadas no se sobrescriben: lo jugado antes conserva su versión (S5-01)", async () => {
    const ejercicios = ejerciciosVocales();
    const { nav, aula } = await docenteConAula({ ejercicios });
    const partidaAntigua = (await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[0], juegoId: aula.juego } })).cuerpo;
    assert.equal(partidaAntigua.versionId, aula.version);

    // Nueva versión con otra consigna, aprobada
    const editados = ejercicios.map((e, i) => (i === 0 ? { ...e, consigna: "¿Con qué vocal comienza esta palabra? (1)" } : e));
    const v2 = (await nav.llamar(`/api/juegos/${aula.juego}/versiones`, { metodo: "POST", cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: editados } })).cuerpo.id;
    assert.equal((await nav.llamar(`/api/juegos/${aula.juego}/versiones/${v2}/aprobar`, { metodo: "POST" })).status, 200);

    const antigua = (await nav.llamar(`/api/juegos/${aula.juego}/versiones/${aula.version}`)).cuerpo;
    assert.equal(antigua.ejercicios[0].consigna, ejercicios[0].consigna, "la versión 1 no cambió");
    assert.equal((await nav.llamar(`/api/partidas/${partidaAntigua.id}`)).cuerpo.versionId, aula.version, "la partida en curso sigue con la versión 1");
    const nueva = (await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[1], juegoId: aula.juego } })).cuerpo;
    assert.equal(nueva.versionId, v2, "una partida nueva usa el contenido actualizado");
  });

  prueba("dos cuentas de docente no pueden acceder a datos de la otra (criterio de cierre)", async () => {
    const ejercicios = ejerciciosVocales();
    const { nav: a, aula } = await docenteConAula({ ejercicios });
    const partida = (await a.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[0], juegoId: aula.juego } })).cuerpo.id;
    const b = crearNavegador(servidor);
    await registrarDocente(b);

    // Lectura de ids ajenos: siempre «no encontrado», nunca el dato
    for (const ruta of [
      `/api/cursos/${aula.curso}`, `/api/estudiantes/${aula.estudiantes[0]}`, `/api/juegos/${aula.juego}`,
      `/api/juegos/${aula.juego}/versiones`, `/api/juegos/${aula.juego}/versiones/${aula.version}`, `/api/partidas/${partida}`
    ]) {
      assert.equal((await b.llamar(ruta)).status, 404, `GET ${ruta}`);
    }
    // Escritura sobre datos ajenos
    assert.equal((await b.llamar(`/api/partidas/${partida}/intentos`, { metodo: "POST", cuerpo: { ejercicioId: "e1", eleccion: "a", operacionId: op() } })).status, 404);
    assert.equal((await b.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[0], juegoId: aula.juego } })).status, 404);
    assert.equal((await b.llamar(`/api/juegos/${aula.juego}`, { metodo: "PUT", cuerpo: { titulo: "Robada por otra cuenta" } })).status, 404);
    assert.equal((await b.llamar("/api/estudiantes", { metodo: "POST", cuerpo: { cursoId: aula.curso, codigoLista: "Z99", franjaEdad: 6, avatarId: "gato" } })).status, 404);
    // Listados y agregados: vacíos
    assert.equal((await b.llamar("/api/juegos")).cuerpo.total, 0);
    assert.equal((await b.llamar("/api/partidas")).cuerpo.length, 0);
    assert.equal((await b.llamar("/api/resultados")).cuerpo.resumen.partidas, 0);
    assert.equal((await b.llamar(`/api/resultados?cursoId=${aula.curso}`)).cuerpo.partidas.length, 0, "ni filtrando por el curso ajeno");
    // Y el dueño sigue viendo lo suyo
    assert.equal((await a.llamar(`/api/juegos/${aula.juego}`)).cuerpo.titulo, "Las vocales de los animales");
  });

  prueba("reinicio del servidor: se conservan las actividades y la sesión, y una partida en curso se reanuda (criterio de cierre)", async () => {
    const ejercicios = ejerciciosVocales();
    const { nav, aula } = await docenteConAula({ ejercicios });
    const partida = (await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[0], juegoId: aula.juego } })).cuerpo.id;
    await responder(nav, partida, ejercicios[0], eleccionCorrecta(ejercicios[0]));
    await responder(nav, partida, ejercicios[1], eleccionIncorrecta(ejercicios[1]));

    // Reinicio: se cierra el servidor y se levanta otro sobre las mismas bases
    const anterior = servidor;
    await anterior.cerrar();
    servidor = await levantarServidor();
    nav.apuntarA(servidor);

    // La cookie de antes sigue valiendo (la sesión vive en MongoDB, no en la memoria del proceso)
    assert.equal((await nav.llamar("/api/docentes/sesion")).status, 200, "la sesión sobrevive al reinicio");
    // Las actividades siguen ahí
    assert.equal((await nav.llamar("/api/juegos")).cuerpo.total, 1);
    // La partida sigue en curso, con lo respondido
    const enCurso = (await nav.llamar(`/api/partidas/${partida}`)).cuerpo;
    assert.equal(enCurso.estado, "en_curso");
    assert.equal(enCurso.intentos.length, 2);
    // No se abre una segunda partida: volver a iniciar se rechaza y el docente retoma la que quedó a medias
    const duplicada = await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[0], juegoId: aula.juego } });
    assert.equal(duplicada.status, 409);
    assert.equal(duplicada.cuerpo.codigo, "PARTIDA_EN_CURSO_EXISTENTE");
    const retomar = (await nav.llamar("/api/inicio")).cuerpo.enCurso;
    assert.deepEqual([retomar.total, retomar.partidas[0].id], [1, partida], "el inicio ofrece retomarla");
    const jugable = await nav.llamar(`/api/partidas/${partida}/jugable`);
    assert.equal(jugable.status, 200, "el estado jugable se puede pedir de nuevo");
    assert.equal(enCurso.ejercicioActual, 1, "continúa en el ejercicio 2, donde se quedó");
    // El ejercicio 2 se falló una vez: se reintenta y se sigue hasta el final
    for (const ejercicio of ejercicios.slice(1)) {
      assert.equal((await responder(nav, partida, ejercicio, eleccionCorrecta(ejercicio))).status, 200);
    }
    assert.equal((await nav.llamar(`/api/partidas/${partida}`)).cuerpo.estado, "finalizada");
    // Una escritura tras el reinicio también pasa (el token CSRF sigue siendo válido)
    assert.equal((await nav.llamar(`/api/juegos/${aula.juego}`, { metodo: "PUT", cuerpo: { titulo: "Vocales después del reinicio" } })).status, 200);
  });

  prueba("con la generación deshabilitada lo guardado funciona, y repetir una actividad no aumenta las solicitudes de IA (criterio de cierre)", async () => {
    const ejercicios = ejerciciosVocales();
    const { nav, aula } = await docenteConAula({ ejercicios });

    const rechazada = await nav.llamar("/api/generaciones", {
      metodo: "POST", cabeceras: { "idempotency-key": `aceptacion-${Date.now()}-0001` },
      cuerpo: { cursoId: aula.curso, habilidad: "vocales", tematica: "animales", cantidad: 5 }
    });
    assert.equal(rechazada.status, 503);
    assert.equal(rechazada.cuerpo.codigo, "GENERACION_DESHABILITADA");
    const solicitudes = (await nav.llamar("/api/generaciones")).cuerpo.length;
    const cupo = (await nav.llamar("/api/cuotas")).cuerpo;
    assert.equal(cupo.generacionHabilitada, false);

    // La actividad guardada se juega varias veces
    for (const estudiante of aula.estudiantes) {
      const partida = (await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: estudiante, juegoId: aula.juego } })).cuerpo.id;
      for (const ejercicio of ejercicios) await responder(nav, partida, ejercicio, eleccionCorrecta(ejercicio));
    }
    assert.equal((await nav.llamar("/api/partidas?estado=finalizada")).cuerpo.length, 3);
    assert.equal((await nav.llamar("/api/generaciones")).cuerpo.length, solicitudes, "jugar no crea solicitudes de IA");
    assert.deepEqual((await nav.llamar("/api/cuotas")).cuerpo.diaria, cupo.diaria, "jugar no consume cupo de IA");
  });

  prueba("los resultados coinciden con el historial de respuestas (criterio de cierre)", async () => {
    const ejercicios = ejerciciosVocales();
    const { nav, aula } = await docenteConAula({ ejercicios });
    const partida = (await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId: aula.estudiantes[0], juegoId: aula.juego } })).cuerpo.id;
    const [e1, e2, e3, e4, e5] = ejercicios;
    const pista = (e) => nav.llamar(`/api/partidas/${partida}/pistas`, { metodo: "POST", cuerpo: { ejercicioId: e.id, operacionId: op() } });

    // Guion conocido: e1 con pista y un fallo; e2 a la primera; e3 agota los dos intentos; e4 a la primera; e5 con un fallo
    await pista(e1);
    await responder(nav, partida, e1, eleccionIncorrecta(e1));
    await responder(nav, partida, e1, eleccionCorrecta(e1));
    await responder(nav, partida, e2, eleccionCorrecta(e2));
    await responder(nav, partida, e3, eleccionIncorrecta(e3));
    await responder(nav, partida, e3, eleccionIncorrecta(e3));
    await responder(nav, partida, e4, eleccionCorrecta(e4));
    await responder(nav, partida, e5, eleccionIncorrecta(e5));
    await responder(nav, partida, e5, eleccionCorrecta(e5));

    const esperado = { respondidos: 5, primerIntento: 2, sinAyuda: 3, intentosTotales: 8, pistas: 1, completados: 5, disponibles: 5 };

    // 1) El guion, calculado a mano arriba, coincide con lo que reporta el servidor
    const resultados = (await nav.llamar("/api/resultados")).cuerpo;
    assert.deepEqual({ ...resultados.resumen, partidas: undefined, enCurso: undefined, abandonadas: undefined },
      { ...esperado, partidas: undefined, enCurso: undefined, abandonadas: undefined });

    // 2) Y también coincide con el historial crudo de la partida, recalculado aquí por separado
    const historial = (await nav.llamar(`/api/partidas/${partida}`)).cuerpo;
    const porEjercicio = Map.groupBy(historial.intentos, (i) => i.ejercicioId);
    const conPista = new Set(historial.pistas.map((p) => p.ejercicioId));
    const aciertos = (lista) => lista.some((i) => i.esCorrecto);
    assert.equal(porEjercicio.size, esperado.respondidos);
    assert.equal([...porEjercicio.values()].filter((l) => l.some((i) => i.numeroIntento === 1 && i.esCorrecto)).length, esperado.primerIntento);
    assert.equal([...porEjercicio.entries()].filter(([id, l]) => aciertos(l) && !conPista.has(id)).length, esperado.sinAyuda);
    assert.equal(historial.intentos.length, esperado.intentosTotales);
    assert.equal(conPista.size, esperado.pistas);

    // 3) El detalle por estudiante y la partida individual suman lo mismo que el resumen
    assert.equal(resultados.porEstudiante[0].intentosTotales, esperado.intentosTotales);
    assert.equal(resultados.partidas[0].indicadores.sinAyuda, esperado.sinAyuda);
  });
});

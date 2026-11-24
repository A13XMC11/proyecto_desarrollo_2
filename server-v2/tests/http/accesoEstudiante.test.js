// Acceso de estudiantes con el código del curso (sin cuenta): quién entra, qué alcanza y qué no.
const { describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_ENABLED = "false";

const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");
const { levantarServidor, crearNavegador, registrarDocente, prepararAula } = require("../aceptacion/ayudas");
const { ejerciciosVocales, eleccionCorrecta, eleccionIncorrecta } = require("../../scripts/contenidoFicticio");

const prueba = pruebasConBase("AccesoEstudiante", { sql: true, mongo: true });

let servidor;
before(async () => {
  servidor = await levantarServidor();
});
after(async () => {
  await servidor.cerrar();
});

let operacion = 0;
const op = () => `acceso-${Date.now()}-${++operacion}`;

// Docente con curso (estudiantes A01..A03) y una actividad aprobada; devuelve también el código del curso
async function aulaConCodigo() {
  await crearAsegurarCanales().ejecutar();
  const ejercicios = ejerciciosVocales();
  const docente = crearNavegador(servidor);
  await registrarDocente(docente);
  const aula = await prepararAula(docente, { ejercicios });
  const curso = await docente.llamar(`/api/cursos/${aula.curso}/codigo-acceso`, { metodo: "POST" });
  return { docente, aula, ejercicios, codigo: curso.cuerpo.codigoAcceso, curso };
}

const entrar = (nav, codigoAcceso, codigoLista) => nav.llamar("/api/estudiante/ingresar", { metodo: "POST", cuerpo: { codigoAcceso, codigoLista } });

describe("Acceso de estudiantes por código de curso", () => {
  prueba("el docente abre el acceso: código de 8 caracteres legibles; sin él nadie entra", async () => {
    await crearAsegurarCanales().ejecutar();
    const docente = crearNavegador(servidor);
    await registrarDocente(docente);
    const aula = await prepararAula(docente, { ejercicios: ejerciciosVocales() });

    const antes = await docente.llamar(`/api/cursos/${aula.curso}`);
    assert.equal(antes.cuerpo.codigoAcceso, null, "los cursos nacen con el acceso cerrado");

    const abierto = await docente.llamar(`/api/cursos/${aula.curso}/codigo-acceso`, { metodo: "POST" });
    assert.equal(abierto.status, 200);
    assert.match(abierto.cuerpo.codigoAcceso, /^[A-HJKMNP-Z2-9]{8}$/);

    // Un PUT del curso no puede fijar el código a mano
    await docente.llamar(`/api/cursos/${aula.curso}`, { metodo: "PUT", cuerpo: { codigoAcceso: "AAAAAAAA" } });
    assert.equal((await docente.llamar(`/api/cursos/${aula.curso}`)).cuerpo.codigoAcceso, abierto.cuerpo.codigoAcceso);
  });

  prueba("entra con el código (en minúsculas y con guion) y su número de lista; no recibe permisos de docente", async () => {
    const { codigo } = await aulaConCodigo();
    const nino = crearNavegador(servidor);
    const r = await entrar(nino, `${codigo.slice(0, 4)}-${codigo.slice(4)}`.toLowerCase(), "a02");
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.codigoLista, "A02");
    assert.equal(r.cuerpo.id, undefined, "no se expone el id interno");

    assert.equal((await nino.llamar("/api/estudiante/yo")).status, 200);
    for (const ruta of ["/api/cursos", "/api/juegos", "/api/estudiantes", "/api/resultados", "/api/partidas", "/api/docentes/sesion"]) {
      assert.equal((await nino.llamar(ruta)).status, 401, `${ruta} sigue siendo solo de docentes`);
    }
  });

  prueba("código o número incorrectos dan el mismo 401 (no revelan si el curso existe)", async () => {
    const { codigo } = await aulaConCodigo();
    const nino = crearNavegador(servidor);
    const codigoMalo = await entrar(nino, "ZZZZZZZZ", "A01");
    const listaMala = await entrar(nino, codigo, "NOEXISTE");
    const vacio = await entrar(nino, undefined, undefined);
    for (const r of [codigoMalo, listaMala, vacio]) {
      assert.equal(r.status, 401);
      assert.equal(r.cuerpo.codigo, "ACCESO_INVALIDO");
    }
    assert.equal(codigoMalo.cuerpo.message, listaMala.cuerpo.message);
    assert.equal((await nino.llamar("/api/estudiante/yo")).status, 401, "no quedó sesión");
  });

  prueba("un estudiante archivado no entra; el código de un curso archivado tampoco", async () => {
    const { docente, aula, codigo } = await aulaConCodigo();
    await docente.llamar(`/api/estudiantes/${aula.estudiantes[0]}`, { metodo: "DELETE" });
    assert.equal((await entrar(crearNavegador(servidor), codigo, "A01")).status, 401);
    assert.equal((await entrar(crearNavegador(servidor), codigo, "A02")).status, 200);
    await docente.llamar(`/api/cursos/${aula.curso}`, { metodo: "DELETE" });
    assert.equal((await entrar(crearNavegador(servidor), codigo, "A02")).status, 401);
  });

  prueba("rotar el código invalida el anterior; revocarlo cierra el acceso", async () => {
    const { docente, aula, codigo } = await aulaConCodigo();
    const nuevo = (await docente.llamar(`/api/cursos/${aula.curso}/codigo-acceso`, { metodo: "POST" })).cuerpo.codigoAcceso;
    assert.notEqual(nuevo, codigo);
    assert.equal((await entrar(crearNavegador(servidor), codigo, "A01")).status, 401);
    assert.equal((await entrar(crearNavegador(servidor), nuevo, "A01")).status, 200);

    const cerrado = await docente.llamar(`/api/cursos/${aula.curso}/codigo-acceso`, { metodo: "DELETE" });
    assert.equal(cerrado.cuerpo.codigoAcceso, null);
    assert.equal((await entrar(crearNavegador(servidor), nuevo, "A01")).status, 401);
  });

  prueba("ve solo actividades aprobadas de su curso, dirigidas a todos o a él, y sin datos internos", async () => {
    const { docente, aula, codigo } = await aulaConCodigo();
    // Una actividad aún en borrador y otra dirigida a otro estudiante
    await docente.llamar("/api/juegos", { metodo: "POST", cuerpo: { cursoId: aula.curso, titulo: "Borrador", habilidad: "vocales" } });
    const ajeno = (await docente.llamar("/api/juegos", { metodo: "POST", cuerpo: { cursoId: aula.curso, estudianteId: aula.estudiantes[1], titulo: "Solo para A02", habilidad: "vocales" } })).cuerpo.id;
    const v = (await docente.llamar(`/api/juegos/${ajeno}/versiones`, { metodo: "POST", cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejerciciosVocales() } })).cuerpo.id;
    await docente.llamar(`/api/juegos/${ajeno}/versiones/${v}/aprobar`, { metodo: "POST" });

    const nino = crearNavegador(servidor);
    await entrar(nino, codigo, "A01");
    const lista = (await nino.llamar("/api/estudiante/juegos")).cuerpo;
    assert.deepEqual(lista.map((j) => j.titulo), ["Las vocales de los animales"]);
    assert.deepEqual(Object.keys(lista[0]).sort(), ["habilidad", "id", "mecanica", "partidaEnCurso", "titulo"]);

    const otro = crearNavegador(servidor);
    await entrar(otro, codigo, "A02");
    assert.equal((await otro.llamar("/api/estudiante/juegos")).cuerpo.length, 2, "A02 ve además la suya");
  });

  prueba("juega una partida completa desde su sesión; el docente ve el resultado a nombre del estudiante", async () => {
    const { docente, aula, ejercicios, codigo } = await aulaConCodigo();
    const nino = crearNavegador(servidor);
    await entrar(nino, codigo, "A01");

    const inicio = await nino.llamar("/api/estudiante/partidas", { metodo: "POST", cuerpo: { juegoId: aula.juego, estudianteId: aula.estudiantes[2] } });
    assert.equal(inicio.status, 201);
    const partida = inicio.cuerpo.id;

    // Reanudar: pedir el mismo juego otra vez devuelve la misma partida
    const repetido = await nino.llamar("/api/estudiante/partidas", { metodo: "POST", cuerpo: { juegoId: aula.juego } });
    assert.equal(repetido.cuerpo.id, partida);
    assert.equal((await nino.llamar("/api/estudiante/juegos")).cuerpo[0].partidaEnCurso, partida);

    const jugable = (await nino.llamar(`/api/estudiante/partidas/${partida}/jugable`)).cuerpo;
    assert.equal(jugable.ejercicios.length, ejercicios.length);
    assert.equal(JSON.stringify(jugable).includes("respuestaCorrecta"), false, "no se filtran respuestas");

    const fallo = await nino.llamar(`/api/estudiante/partidas/${partida}/intentos`, { metodo: "POST", cuerpo: { ejercicioId: ejercicios[0].id, eleccion: eleccionIncorrecta(ejercicios[0]), operacionId: op() } });
    assert.equal(fallo.cuerpo.esCorrecto, false);
    for (const [i, ejercicio] of ejercicios.entries()) {
      const r = await nino.llamar(`/api/estudiante/partidas/${partida}/intentos`, { metodo: "POST", cuerpo: { ejercicioId: ejercicio.id, eleccion: eleccionCorrecta(ejercicio), operacionId: op() } });
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.terminada, i === ejercicios.length - 1);
    }

    // La partida quedó a nombre de A01 (no del A03 que el cuerpo intentó imponer)
    const partidas = (await docente.llamar(`/api/partidas?estudianteId=${aula.estudiantes[0]}`)).cuerpo;
    assert.equal(partidas.length, 1);
    assert.equal(partidas[0].estado, "finalizada");
    assert.equal((await docente.llamar(`/api/partidas?estudianteId=${aula.estudiantes[2]}`)).cuerpo.length, 0);
  });

  prueba("no alcanza la partida de otro estudiante ni la de otro docente", async () => {
    const { aula, codigo } = await aulaConCodigo();
    const a = crearNavegador(servidor);
    const b = crearNavegador(servidor);
    await entrar(a, codigo, "A01");
    await entrar(b, codigo, "A02");
    const partida = (await a.llamar("/api/estudiante/partidas", { metodo: "POST", cuerpo: { juegoId: aula.juego } })).cuerpo.id;

    for (const [metodo, sufijo] of [["GET", "jugable"], ["POST", "intentos"], ["POST", "pistas"]]) {
      const r = await b.llamar(`/api/estudiante/partidas/${partida}/${sufijo}`, { metodo, cuerpo: metodo === "POST" ? { ejercicioId: "x", operacionId: op() } : undefined });
      assert.equal(r.status, 404, `${sufijo} de otro estudiante`);
    }

    // Un curso de otro docente: su juego no se puede iniciar con esta sesión
    const { aula: otraAula } = await aulaConCodigo();
    assert.equal((await a.llamar("/api/estudiante/partidas", { metodo: "POST", cuerpo: { juegoId: otraAula.juego } })).status, 404);
  });

  prueba("las operaciones que cambian datos exigen el token CSRF; salir cierra la sesión", async () => {
    const { aula, codigo } = await aulaConCodigo();
    const nino = crearNavegador(servidor);
    await entrar(nino, codigo, "A01");

    const sinToken = await nino.llamar("/api/estudiante/partidas", { metodo: "POST", cuerpo: { juegoId: aula.juego }, cabeceras: { "x-csrf-token": "falso" } });
    assert.equal(sinToken.status, 403);
    assert.equal(sinToken.cuerpo.codigo, "CSRF_INVALIDO");

    // Tras recargar, /yo devuelve el token para seguir
    assert.equal((await nino.llamar("/api/estudiante/yo")).status, 200);
    assert.equal((await nino.llamar("/api/estudiante/salir", { metodo: "POST" })).status, 204);
    assert.equal((await nino.llamar("/api/estudiante/yo")).status, 401);
  });

  prueba("si el docente prueba en el mismo navegador, entrar como estudiante no le cierra su sesión", async () => {
    const { docente, codigo } = await aulaConCodigo();
    assert.equal((await entrar(docente, codigo, "A01")).status, 200);
    assert.equal((await docente.llamar("/api/cursos")).status, 200, "sigue siendo docente");
    assert.equal((await docente.llamar("/api/estudiante/yo")).status, 200, "y además juega como estudiante");
    await docente.llamar("/api/estudiante/salir", { metodo: "POST" });
    assert.equal((await docente.llamar("/api/cursos")).status, 200);
  });

  // Va al final: agota el cupo de fallos de esta IP en este servidor
  prueba("tras muchos intentos fallidos desde la misma IP se frena con 429, aun con el código correcto", async () => {
    const { codigo } = await aulaConCodigo();
    const nino = crearNavegador(servidor);
    let estado = 0;
    for (let i = 0; i < 40 && estado !== 429; i++) estado = (await entrar(nino, "ZZZZZZZZ", "A01")).status;
    assert.equal(estado, 429);
    const bloqueado = await entrar(nino, codigo, "A01");
    assert.equal(bloqueado.status, 429);
    assert.equal(bloqueado.cuerpo.codigo, "DEMASIADOS_INTENTOS");
  });
});

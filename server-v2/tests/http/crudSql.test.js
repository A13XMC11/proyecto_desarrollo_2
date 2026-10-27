const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor, registrarDocente } = require("./cliente");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");

const prueba = pruebasConBase("crudSql", { sql: true, mongo: true });
const llamar = conServidor();
const CURSO = { grado: "1.º EGB", paralelo: "a", anioLectivo: "2026-2027" };

describe("CRUD HTTP sobre PostgreSQL", () => {
  prueba("docentes: crear, listar, obtener, actualizar y eliminar", async () => {
    const datos = { nombre: "Ana Pérez", correo: "ana@escuela.ec", contrasena: "clave12345" };
    const creado = await llamar("/api/docentes", { metodo: "POST", cuerpo: datos });
    assert.equal(creado.status, 201);
    assert.equal(creado.cuerpo.hash, undefined);
    const id = creado.cuerpo.id;
    assert.equal((await llamar("/api/docentes", { metodo: "POST", cuerpo: datos })).status, 409);
    assert.equal((await llamar("/api/docentes", { metodo: "POST", cuerpo: { ...datos, correo: "x" } })).status, 400);
    assert.equal((await llamar("/api/docentes", { metodo: "POST", cuerpo: { ...datos, correo: "b@x.ec", contrasena: "corta" } })).status, 400);
    assert.equal((await llamar("/api/docentes", { metodo: "POST", cuerpo: { ...datos, correo: "c@x.ec", contrasena: "x".repeat(129) } })).status, 400, "contraseña demasiado larga");

    const lista = await llamar("/api/docentes", { docente: id });
    assert.equal(lista.status, 200);
    assert.deepEqual(lista.cuerpo.map((d) => d.id), [id], "el listado solo contiene la cuenta propia");
    assert.equal(lista.cuerpo[0].correo, undefined, "el listado no expone correos");

    assert.equal((await llamar(`/api/docentes/${id}`, { docente: id })).cuerpo.correo, "ana@escuela.ec");
    assert.equal((await llamar("/api/docentes/123e4567-e89b-42d3-a456-426614174000", { docente: id })).status, 404);
    assert.equal((await llamar("/api/docentes/no-es-uuid", { docente: id })).status, 404);

    const otro = await registrarDocente(llamar);
    assert.equal((await llamar(`/api/docentes/${id}`, { docente: otro })).status, 404, "no lee la cuenta (ni el correo) de otro docente");
    assert.equal((await llamar(`/api/docentes/${id}`, { metodo: "PUT", docente: otro, cuerpo: { nombre: "Hack" } })).status, 404, "no edita cuentas ajenas");
    const editado = await llamar(`/api/docentes/${id}`, { metodo: "PUT", docente: id, cuerpo: { nombre: "Ana Mora", institucion: "Escuela Sol" } });
    assert.equal(editado.cuerpo.nombre, "Ana Mora");
    assert.equal(editado.cuerpo.institucion, "Escuela Sol");
    assert.equal((await llamar(`/api/docentes/${id}`, { metodo: "PUT", docente: id, cuerpo: { institucion: null } })).cuerpo.institucion, undefined);
    assert.equal((await llamar(`/api/docentes/${id}`, { metodo: "PUT", docente: id, cuerpo: { nombre: "A" } })).status, 400);

    assert.equal((await llamar(`/api/docentes/${otro}`, { metodo: "DELETE", docente: id })).status, 404);
    assert.equal((await llamar(`/api/docentes/${otro}`, { metodo: "DELETE", docente: otro })).status, 204);
    assert.equal((await llamar(`/api/docentes/${otro}`, { docente: id })).status, 404);
  });

  prueba("un docente con cursos no se puede eliminar (409)", async () => {
    const docente = await registrarDocente(llamar);
    await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: CURSO });
    assert.equal((await llamar(`/api/docentes/${docente}`, { metodo: "DELETE", docente })).status, 409);
  });

  prueba("cursos: crear, listar, obtener, actualizar y archivar, aislados por docente", async () => {
    const docente = await registrarDocente(llamar);
    const ajeno = await registrarDocente(llamar);
    const creado = await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: CURSO });
    assert.equal(creado.status, 201);
    assert.equal(creado.cuerpo.paralelo, "A");
    const id = creado.cuerpo.id;
    assert.equal((await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: CURSO })).status, 409);
    assert.equal((await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { ...CURSO, grado: "9.º" } })).status, 400);

    assert.equal((await llamar("/api/cursos", { docente })).cuerpo.length, 1);
    assert.equal((await llamar("/api/cursos", { docente: ajeno })).cuerpo.length, 0);
    assert.equal((await llamar(`/api/cursos/${id}`, { docente })).cuerpo.id, id);
    assert.equal((await llamar(`/api/cursos/${id}`, { docente: ajeno })).status, 404);

    const editado = await llamar(`/api/cursos/${id}`, { metodo: "PUT", docente, cuerpo: { paralelo: "b" } });
    assert.equal(editado.cuerpo.paralelo, "B");
    assert.equal((await llamar(`/api/cursos/${id}`, { metodo: "PUT", docente, cuerpo: { anioLectivo: "2026-2030" } })).status, 400);
    assert.equal((await llamar(`/api/cursos/${id}`, { metodo: "PUT", docente: ajeno, cuerpo: { paralelo: "C" } })).status, 404);

    assert.equal((await llamar(`/api/cursos/${id}`, { metodo: "DELETE", docente: ajeno })).status, 404);
    assert.equal((await llamar(`/api/cursos/${id}`, { metodo: "DELETE", docente })).status, 204);
    assert.equal((await llamar(`/api/cursos/${id}`, { docente })).cuerpo.archivado, true);
    assert.equal((await llamar("/api/cursos?archivado=false", { docente })).cuerpo.length, 0);
    assert.equal((await llamar("/api/cursos?archivado=true", { docente })).cuerpo.length, 1);
  });

  prueba("estudiantes: crear, listar por curso, obtener, actualizar y archivar", async () => {
    const docente = await registrarDocente(llamar);
    const ajeno = await registrarDocente(llamar);
    const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: CURSO })).cuerpo.id;
    const datos = { cursoId: curso, codigoLista: "a01", franjaEdad: 6, avatarId: "gato", apodo: "Luz", intereses: ["animales", "naturaleza"] };

    const creado = await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: datos });
    assert.equal(creado.status, 201);
    assert.equal(creado.cuerpo.codigoLista, "A01");
    assert.deepEqual(creado.cuerpo.intereses, ["animales", "naturaleza"]);
    const id = creado.cuerpo.id;
    assert.equal((await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: datos })).status, 409, "código repetido en el curso");
    assert.equal((await llamar("/api/estudiantes", { metodo: "POST", docente: ajeno, cuerpo: { ...datos, codigoLista: "B1" } })).status, 404, "curso ajeno");
    assert.equal((await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { ...datos, codigoLista: "B2", franjaEdad: 9 } })).status, 400);
    assert.equal((await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { ...datos, codigoLista: "B3", apodo: "<b>x</b>" } })).status, 400);

    assert.equal((await llamar(`/api/estudiantes?cursoId=${curso}`, { docente })).cuerpo.length, 1);
    assert.equal((await llamar(`/api/estudiantes?cursoId=${curso}`, { docente: ajeno })).status, 404);
    assert.equal((await llamar("/api/estudiantes", { docente })).status, 404, "falta el curso");
    assert.equal((await llamar(`/api/estudiantes/${id}`, { docente })).cuerpo.apodo, "Luz");
    assert.equal((await llamar(`/api/estudiantes/${id}`, { docente: ajeno })).status, 404);

    const editado = await llamar(`/api/estudiantes/${id}`, { metodo: "PUT", docente, cuerpo: { apodo: null, franjaEdad: 7, intereses: ["objetos_cotidianos"] } });
    assert.equal(editado.cuerpo.apodo, undefined);
    assert.equal(editado.cuerpo.franjaEdad, 7);
    assert.deepEqual(editado.cuerpo.intereses, ["objetos_cotidianos"]);
    assert.equal((await llamar(`/api/estudiantes/${id}`, { metodo: "PUT", docente, cuerpo: { franjaEdad: 9 } })).status, 400);
    assert.equal((await llamar(`/api/estudiantes/${id}`, { metodo: "PUT", docente, cuerpo: { archivado: null } })).status, 400);
    assert.equal((await llamar(`/api/estudiantes/${id}`, { metodo: "PUT", docente, cuerpo: { intereses: null } })).status, 400);
    assert.equal((await llamar(`/api/estudiantes/${id}`, { metodo: "PUT", docente: ajeno, cuerpo: { franjaEdad: 5 } })).status, 404);

    assert.equal((await llamar(`/api/estudiantes/${id}`, { metodo: "DELETE", docente })).status, 204);
    assert.equal((await llamar(`/api/estudiantes/${id}`, { docente })).cuerpo.archivado, true);
    assert.equal((await llamar(`/api/estudiantes?cursoId=${curso}&archivado=false`, { docente })).cuerpo.length, 0);
  });

  prueba("generaciones: solicitar (idempotente), listar, obtener y cancelar; cuotas de solo lectura", async () => {
    await crearAsegurarCanales().ejecutar();
    const docente = await registrarDocente(llamar);
    const ajeno = await registrarDocente(llamar);
    const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: CURSO })).cuerpo.id;
    const estudiante = (await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { cursoId: curso, codigoLista: "G1", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
    const datos = { cursoId: curso, estudianteId: estudiante, habilidad: "vocales", tematica: "animales", cantidad: 5, instruccion: "Animales de la granja" };
    const clave = { "idempotency-key": "clave-de-prueba-0001" };

    const creada = await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: datos, cabeceras: clave });
    assert.equal(creada.status, 201);
    assert.equal(creada.cuerpo.estado, "pendiente");
    assert.equal(creada.cuerpo.mecanica, undefined, "la mecánica se deduce, no se envía ni se guarda");
    const repetida = await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: datos, cabeceras: clave });
    assert.equal(repetida.status, 200, "misma clave: devuelve la original");
    assert.equal(repetida.cuerpo.id, creada.cuerpo.id);

    assert.equal((await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: datos })).status, 400, "falta la clave de idempotencia");
    assert.equal((await llamar("/api/generaciones", { metodo: "POST", docente: ajeno, cuerpo: datos, cabeceras: { "idempotency-key": "clave-de-prueba-0002" } })).status, 404, "curso ajeno");
    assert.equal((await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: { ...datos, cantidad: 7 }, cabeceras: { "idempotency-key": "clave-de-prueba-0003" } })).status, 400);
    assert.equal((await llamar("/api/generaciones", { metodo: "POST", docente, cuerpo: { ...datos, canal: "otro" }, cabeceras: { "idempotency-key": "clave-de-prueba-0004" } })).status, 400);

    assert.equal((await llamar("/api/generaciones", { docente })).cuerpo.length, 1);
    assert.equal((await llamar("/api/generaciones?estado=completada", { docente })).cuerpo.length, 0);
    assert.equal((await llamar("/api/generaciones", { docente: ajeno })).cuerpo.length, 0);
    assert.equal((await llamar(`/api/generaciones/${creada.cuerpo.id}`, { docente })).cuerpo.parametros.habilidad, "vocales");
    assert.equal((await llamar(`/api/generaciones/${creada.cuerpo.id}`, { docente: ajeno })).status, 404);

    assert.equal((await llamar(`/api/generaciones/${creada.cuerpo.id}`, { metodo: "DELETE", docente: ajeno })).status, 404);
    assert.equal((await llamar(`/api/generaciones/${creada.cuerpo.id}`, { metodo: "DELETE", docente })).status, 204);
    const cancelada = (await llamar(`/api/generaciones/${creada.cuerpo.id}`, { docente })).cuerpo;
    assert.equal(cancelada.estado, "fallida");
    assert.equal(cancelada.errorCodigo, "CANCELADA_POR_DOCENTE");
    assert.equal((await llamar(`/api/generaciones/${creada.cuerpo.id}`, { metodo: "DELETE", docente })).status, 409, "ya no está activa");

    const cuotas = await llamar("/api/cuotas", { docente });
    assert.equal(cuotas.status, 200);
    assert.equal(cuotas.cuerpo.diaria, null);
    assert.equal(cuotas.cuerpo.global, undefined, "el contador global no se expone a los docentes");
    assert.equal((await llamar("/api/cuotas?dia=mal", { docente })).status, 400);
    assert.equal((await llamar("/api/cuotas", { metodo: "POST", docente })).status, 404, "las cuotas no se modifican por HTTP");
  });
});

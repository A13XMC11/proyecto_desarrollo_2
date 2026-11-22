const { describe } = require("node:test");
const assert = require("node:assert/strict");
const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor } = require("./cliente");

const prueba = pruebasConBase("sesion", { sql: true, mongo: true });
const llamar = conServidor();
const CURSO = { grado: "1.º EGB", paralelo: "a", anioLectivo: "2026-2027" };

describe("Sesión del docente con cookie (sprint 1)", () => {
  prueba("registrarse abre la sesión con una cookie HttpOnly y entrega el token CSRF", async () => {
    const r = await llamar("/api/docentes", { metodo: "POST", cuerpo: { nombre: "Ana Pérez", correo: "ana.sesion@escuela.ec", contrasena: "clave12345" } });
    assert.equal(r.status, 201);
    const cookie = r.cabeceras.getSetCookie().find((c) => c.startsWith("letritas.sid="));
    assert.ok(cookie, "llega la cookie de sesión");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.ok(r.cabeceras.get("x-csrf-token"));

    const yo = await llamar("/api/docentes/sesion", { docente: r.cuerpo.id });
    assert.equal(yo.status, 200);
    assert.equal(yo.cuerpo.id, r.cuerpo.id);
    assert.equal(yo.cuerpo.hash, undefined);
    assert.ok(yo.cabeceras.get("x-csrf-token"), "al recargar se recupera el token");
  });

  prueba("la cabecera x-docente-id ya no identifica a nadie", async () => {
    const r = await llamar("/api/docentes", { metodo: "POST", cuerpo: { nombre: "Ana Pérez", correo: "ana.suplantada@escuela.ec", contrasena: "clave12345" } });
    const falsa = await llamar("/api/cursos", { cabeceras: { "x-docente-id": r.cuerpo.id } });
    assert.equal(falsa.status, 401);
  });

  prueba("sin token CSRF no se modifica nada (403)", async () => {
    const r = await llamar("/api/docentes", { metodo: "POST", cuerpo: { nombre: "Ana Pérez", correo: "ana.csrf@escuela.ec", contrasena: "clave12345" } });
    const docente = r.cuerpo.id;
    const sinToken = await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: CURSO, sinCsrf: true });
    assert.equal(sinToken.status, 403);
    assert.equal(sinToken.cuerpo.codigo, "CSRF_INVALIDO");
    assert.equal((await llamar("/api/cursos", { docente })).cuerpo.length, 0, "no se creó el curso");
    assert.equal((await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: CURSO })).status, 201);
  });

  prueba("entrar regenera la sesión; credenciales erróneas dan 401 sin cookie", async () => {
    const datos = { nombre: "Ana Pérez", correo: "ana.entrar@escuela.ec", contrasena: "clave12345" };
    const registro = await llamar("/api/docentes", { metodo: "POST", cuerpo: datos });
    const cookieRegistro = registro.cabeceras.getSetCookie().find((c) => c.startsWith("letritas.sid="));

    const mala = await llamar("/api/docentes/sesion", { metodo: "POST", cuerpo: { correo: datos.correo, contrasena: "otra-clave" } });
    assert.equal(mala.status, 401);
    assert.equal(mala.cuerpo.codigo, "CREDENCIALES_INVALIDAS");
    assert.equal(mala.cabeceras.getSetCookie().length, 0);

    const buena = await llamar("/api/docentes/sesion", { metodo: "POST", cuerpo: { correo: " ANA.entrar@escuela.ec ", contrasena: datos.contrasena } });
    assert.equal(buena.status, 200);
    assert.equal(buena.cuerpo.id, registro.cuerpo.id);
    const cookieEntrada = buena.cabeceras.getSetCookie().find((c) => c.startsWith("letritas.sid="));
    assert.notEqual(cookieEntrada.split(";")[0], cookieRegistro.split(";")[0], "id de sesión nuevo al entrar");
  });

  prueba("salir revoca la sesión en el servidor: la misma cookie deja de servir", async () => {
    const r = await llamar("/api/docentes", { metodo: "POST", cuerpo: { nombre: "Ana Pérez", correo: "ana.salir@escuela.ec", contrasena: "clave12345" } });
    const docente = r.cuerpo.id;
    assert.equal((await llamar("/api/cursos", { docente })).status, 200);

    assert.equal((await llamar("/api/docentes/sesion", { metodo: "DELETE", docente, sinCsrf: true })).status, 403, "salir también exige el token");
    const salida = await llamar("/api/docentes/sesion", { metodo: "DELETE", docente });
    assert.equal(salida.status, 204);
    // El cliente de pruebas reenvía la cookie anterior, como haría quien la hubiera copiado
    assert.equal((await llamar("/api/cursos", { docente })).status, 401);
    assert.equal((await llamar("/api/docentes/sesion", { docente })).status, 401);
  });
});

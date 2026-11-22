#!/usr/bin/env node
// S5-06: comprueba una versión publicada. Criterio de aceptación del plan: "Acceso, cookies, base y generación
// funcionan por HTTPS". Imprime un informe con ✔/✘ y sale con código 1 si algo falla.
//
//   npm run verificar:despliegue -- --url=https://mi-sitio.example
//   Opciones:
//     --origen=https://cliente.example   comprueba CORS si el cliente está en otro origen (lo normal es el mismo)
//     --probar-generacion                crea curso y estudiante y pide UNA generación (con IA real cuesta dinero)
//     --conservar                        no borra la cuenta de verificación al terminar
//   Solo para probar este script en local (nunca contra un sitio real):
//     --permitir-http                    acepta http://localhost y omite lo que exige HTTPS
//     --simular-https                    envía X-Forwarded-Proto: https, como lo haría el proxy de producción
//
// Con credenciales propias (VERIFICAR_CORREO / VERIFICAR_CONTRASENA) usa esa cuenta; si no, registra una cuenta
// ficticia y la borra al terminar (solo se puede borrar si no tiene datos).
const bandera = (n) => process.argv.includes(`--${n}`);
const valor = (n) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
};

const URL_BASE = (valor("url") || "").replace(/\/+$/, "");
const LOCAL = bandera("permitir-http");
const SIMULAR_HTTPS = bandera("simular-https");
if (!URL_BASE) {
  console.error("Falta --url=https://tu-sitio");
  process.exit(2);
}
const base = new URL(URL_BASE);
if (base.protocol !== "https:" && !(LOCAL && ["localhost", "127.0.0.1"].includes(base.hostname))) {
  console.error("La URL debe ser https://. --permitir-http solo vale para localhost y es para probar este script.");
  process.exit(2);
}
if (SIMULAR_HTTPS && !["localhost", "127.0.0.1"].includes(base.hostname)) {
  console.error("--simular-https solo se permite contra localhost.");
  process.exit(2);
}

const resultados = [];
const registrar = (ok, nombre, detalle = "", omitido = false) => {
  resultados.push({ ok, nombre, detalle, omitido });
  console.log(`${omitido ? "–" : ok ? "✔" : "✘"} ${nombre}${detalle ? `\n    ${detalle}` : ""}`);
};

async function pedir(sesion, ruta, { metodo = "GET", cuerpo, cabeceras = {}, sinCsrf = false } = {}) {
  const inicio = performance.now();
  let respuesta;
  try {
    respuesta = await fetch(URL_BASE + ruta, {
      method: metodo,
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        ...(SIMULAR_HTTPS && { "x-forwarded-proto": "https" }),
        ...(sesion && { cookie: sesion.cookie }),
        ...(sesion && !sinCsrf && { "x-csrf-token": sesion.csrf }),
        ...cabeceras
      },
      body: cuerpo && JSON.stringify(cuerpo)
    });
  } catch (error) {
    return { status: 0, error: error.cause?.code || error.message, ms: performance.now() - inicio, cabeceras: new Headers() };
  }
  const texto = await respuesta.text();
  let datos;
  try { datos = texto ? JSON.parse(texto) : undefined; } catch { datos = undefined; }
  return { status: respuesta.status, cuerpo: datos, cabeceras: respuesta.headers, setCookie: respuesta.headers.getSetCookie(), ms: performance.now() - inicio };
}

const cookieDeSesion = (r) => (r.setCookie || []).find((c) => c.startsWith("letritas.sid="));
const sesionDe = (r) => {
  const c = cookieDeSesion(r);
  const csrf = r.cabeceras.get("x-csrf-token");
  return c && csrf ? { cookie: c.split(";")[0], csrf } : undefined;
};

async function main() {
  console.log(`Verificando ${URL_BASE}\n`);

  // 1. Disponibilidad y HTTPS
  const salud = await pedir(null, "/api/health");
  registrar(salud.status === 200 && salud.cuerpo?.ok === true, "La API responde (/api/health)",
    salud.status === 200 ? `${salud.ms.toFixed(0)} ms` : `estado ${salud.status}${salud.error ? ` (${salud.error})` : ""}. ¿El proxy reenvía /api al servidor?`);
  if (salud.status !== 200) return;
  registrar(base.protocol === "https:", "La conexión es HTTPS", base.protocol === "https:" ? "" : "modo local", base.protocol !== "https:");

  // 2. Sin sesión no se entra
  const sinSesion = await pedir(null, "/api/inicio");
  registrar(sinSesion.status === 401, "Sin sesión, la API rechaza con 401", `estado ${sinSesion.status}`);

  // 3. Registro o acceso y cookie
  const propio = process.env.VERIFICAR_CORREO && process.env.VERIFICAR_CONTRASENA;
  const correo = propio ? process.env.VERIFICAR_CORREO : `verificacion${Date.now()}@escuela.ec`;
  const contrasena = propio ? process.env.VERIFICAR_CONTRASENA : "clave12345-verificacion";
  const entrada = propio
    ? await pedir(null, "/api/docentes/sesion", { metodo: "POST", cuerpo: { correo, contrasena } })
    : await pedir(null, "/api/docentes", { metodo: "POST", cuerpo: { nombre: "Verificación Automática", correo, contrasena } });
  const sesion = sesionDe(entrada);
  registrar(Boolean(sesion), propio ? "Se puede iniciar sesión" : "Se puede registrar un docente y abre sesión",
    sesion ? "" : `estado ${entrada.status} ${JSON.stringify(entrada.cuerpo || {})}`);
  if (!sesion) return;
  const idDocente = entrada.cuerpo.id;

  const atributos = cookieDeSesion(entrada).split(";").map((p) => p.trim().toLowerCase());
  registrar(atributos.includes("httponly"), "Cookie HttpOnly (el navegador no la deja leer a scripts)");
  registrar(atributos.includes("secure"), "Cookie Secure (solo viaja por HTTPS)",
    atributos.includes("secure") ? "" : "Falta. ¿NODE_ENV=production y el proxy envía X-Forwarded-Proto?");
  registrar(atributos.some((a) => a === "samesite=lax" || a === "samesite=strict"), "Cookie SameSite (Lax o Strict)", atributos.find((a) => a.startsWith("samesite")) || "ausente");
  const caduca = atributos.find((a) => a.startsWith("max-age=") || a.startsWith("expires="));
  registrar(Boolean(caduca), "La cookie tiene caducidad", caduca || "ausente");

  // 4. La sesión se guarda en la base (MongoDB) y sirve en la siguiente petición
  const actual = await pedir(sesion, "/api/docentes/sesion");
  registrar(actual.status === 200 && actual.cuerpo?.id === idDocente, "La sesión persiste entre peticiones (almacén en MongoDB)", `estado ${actual.status}`);

  // 5. Base de datos: lectura y escritura en PostgreSQL y MongoDB
  const inicio = await pedir(sesion, "/api/inicio");
  registrar(inicio.status === 200, "Lectura en las dos bases (/api/inicio)", `estado ${inicio.status}, ${inicio.ms.toFixed(0)} ms`);
  const biblioteca = await pedir(sesion, "/api/juegos");
  registrar(biblioteca.status === 200 && Array.isArray(biblioteca.cuerpo?.items ?? biblioteca.cuerpo), "Biblioteca de actividades (MongoDB)", `estado ${biblioteca.status}`);

  // 6. CSRF y cierre de sesión
  const sinCsrf = await pedir(sesion, "/api/cursos", { metodo: "POST", sinCsrf: true, cuerpo: { grado: "1.º EGB", paralelo: "Z", anioLectivo: "2026-2027" } });
  registrar(sinCsrf.status === 403, "Una escritura sin token CSRF se rechaza (403)", `estado ${sinCsrf.status}`);

  // 7. CORS solo si el cliente está en otro origen
  const origen = valor("origen");
  if (origen) {
    const r = await pedir(null, "/api/health", { cabeceras: { origin: origen } });
    const permitido = r.cabeceras.get("access-control-allow-origin");
    registrar(permitido === origen && r.cabeceras.get("access-control-allow-credentials") === "true", `CORS permite ${origen} con credenciales`,
      permitido === origen ? "" : `allow-origin: ${permitido ?? "ausente"}. Ajuste APP_ORIGIN en el servidor.`);
    const ajeno = await pedir(null, "/api/health", { cabeceras: { origin: "https://sitio-ajeno.example" } });
    registrar(!ajeno.cabeceras.get("access-control-allow-origin"), "CORS no abre la API a otros orígenes");
  } else {
    registrar(true, "CORS: no se comprueba (mismo origen; ver --origen)", "", true);
  }

  // 8. Generación
  const cuotas = await pedir(sesion, "/api/cuotas");
  const habilitada = cuotas.cuerpo?.generacionHabilitada;
  registrar(cuotas.status === 200 && typeof habilitada === "boolean", "La consulta de cupo de IA responde",
    cuotas.status === 200 ? `generación ${habilitada ? "HABILITADA" : "deshabilitada"}; límite diario ${cuotas.cuerpo.limiteDiario}; día ${cuotas.cuerpo.dia}` : `estado ${cuotas.status}`);
  let tocoDatos = false;
  if (bandera("probar-generacion")) {
    tocoDatos = true;
    const curso = await pedir(sesion, "/api/cursos", { metodo: "POST", cuerpo: { grado: "1.º EGB", paralelo: "V", anioLectivo: "2026-2027" } });
    const estudiante = curso.status === 201
      ? await pedir(sesion, "/api/estudiantes", { metodo: "POST", cuerpo: { cursoId: curso.cuerpo.id, codigoLista: "V01", franjaEdad: 6, avatarId: "gato" } })
      : curso;
    const clave = `verificacion-${Date.now()}`;
    const generacion = estudiante.status === 201
      ? await pedir(sesion, "/api/generaciones", { metodo: "POST", cabeceras: { "idempotency-key": clave }, cuerpo: { cursoId: curso.cuerpo.id, estudianteId: estudiante.cuerpo.id, habilidad: "vocales", tematica: "animales", cantidad: 5 } })
      : estudiante;
    if (habilitada) {
      registrar(generacion.status === 201 && generacion.cuerpo?.estado === "completada", "Una generación completa un borrador",
        `estado ${generacion.status}, ${generacion.cuerpo?.estado ?? ""} ${generacion.cuerpo?.errorCodigo ?? ""} (${generacion.ms?.toFixed(0)} ms)`);
      const repetida = await pedir(sesion, "/api/generaciones", { metodo: "POST", cabeceras: { "idempotency-key": clave }, cuerpo: { cursoId: curso.cuerpo.id, estudianteId: estudiante.cuerpo.id, habilidad: "vocales", tematica: "animales", cantidad: 5 } });
      registrar(repetida.status === 200 && repetida.cuerpo?.id === generacion.cuerpo?.id, "Repetir la misma clave no genera otra (idempotencia)", `estado ${repetida.status}`);
    } else {
      registrar(generacion.status === 503 && generacion.cuerpo?.codigo === "GENERACION_DESHABILITADA", "Con la IA apagada, pedir una generación se rechaza con 503",
        `estado ${generacion.status} ${generacion.cuerpo?.codigo ?? ""}`);
    }
  } else {
    registrar(true, "Generación: no se prueba (use --probar-generacion)", "", true);
  }

  // 9. Cierre de sesión y limpieza
  const salida = await pedir(sesion, "/api/docentes/sesion", { metodo: "DELETE" });
  const despues = await pedir(sesion, "/api/inicio");
  registrar([200, 204].includes(salida.status) && despues.status === 401, "Cerrar sesión la revoca en el servidor", `salida ${salida.status}, luego ${despues.status}`);

  if (!propio && !bandera("conservar")) {
    if (tocoDatos) {
      console.log(`\nNota: la cuenta ${correo} se conserva porque la prueba creó datos (un docente con datos no se borra).`);
    } else {
      const otra = await pedir(null, "/api/docentes/sesion", { metodo: "POST", cuerpo: { correo, contrasena } });
      const s = sesionDe(otra);
      const borrado = s ? await pedir(s, `/api/docentes/${idDocente}`, { metodo: "DELETE" }) : { status: otra.status };
      registrar([200, 204].includes(borrado.status), "La cuenta de verificación se borró", `estado ${borrado.status}`);
    }
  }
}

main()
  .catch((error) => {
    registrar(false, "La verificación terminó con un error inesperado", error.message);
  })
  .finally(() => {
    const fallos = resultados.filter((r) => !r.ok && !r.omitido);
    const omitidos = resultados.filter((r) => r.omitido).length;
    console.log(`\n${resultados.length - fallos.length - omitidos} correctas, ${fallos.length} con fallo, ${omitidos} omitidas.`);
    process.exit(fallos.length ? 1 : 0);
  });

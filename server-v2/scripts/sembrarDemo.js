#!/usr/bin/env node
// S6-05: datos FICTICIOS para la demostración, creados por la API (no tocan las bases directamente), así que
// sirven igual contra un servidor local o uno publicado. Es repetible: si la cuenta de demostración ya tiene
// datos, no los duplica.
//
//   npm run sembrar:demo -- --url=http://localhost:3977
//   Variables opcionales: DEMO_CORREO (demo@letritas.ec) y DEMO_CONTRASENA (Demo-12345)
//
// Qué deja: una docente, un curso con 8 estudiantes (códigos A01 a A08, sin nombres reales), 3 actividades
// aprobadas (una con dos versiones), 1 borrador por revisar y 14 partidas terminadas con resultados variados, más una partida
// a medias para mostrar «retomar». Todo con guion fijo: la demostración sale igual cada vez.
const { crearNavegador, exigir } = require("./clienteApi");
const { ejerciciosDe, eleccionCorrecta, eleccionIncorrecta } = require("./contenidoFicticio");

const CORREO = process.env.DEMO_CORREO || "demo@letritas.ec";
const CONTRASENA = process.env.DEMO_CONTRASENA || "Demo-12345";

// Cómo responde cada estudiante a cada ejercicio: ok = a la primera, fallo = se equivoca una vez, pista = pide
// ayuda, agotado = se equivoca dos veces (se muestra la solución)
const PERFILES = {
  perfecto: ["ok", "ok", "ok", "ok", "ok"],
  bueno: ["ok", "fallo", "ok", "ok", "ok"],
  regular: ["ok", "pista", "fallo", "ok", "fallo"],
  apoyo: ["pista", "agotado", "pista", "fallo", "agotado"]
};
const ESTUDIANTES = [
  { codigo: "A01", edad: 5, avatar: "gato", perfil: "perfecto", intereses: ["animales"] },
  { codigo: "A02", edad: 6, avatar: "ave", perfil: "bueno", intereses: ["animales", "naturaleza"] },
  { codigo: "A03", edad: 6, avatar: "tortuga", perfil: "regular", intereses: ["naturaleza"] },
  { codigo: "A04", edad: 7, avatar: "pez", perfil: "bueno", intereses: ["objetos_cotidianos"] },
  { codigo: "A05", edad: 5, avatar: "conejo", perfil: "apoyo", intereses: ["animales"] },
  { codigo: "A06", edad: 6, avatar: "ardilla", perfil: "regular", intereses: [] },
  { codigo: "A07", edad: 7, avatar: "gato", perfil: null, intereses: [] }, // tiene una partida a medias
  { codigo: "A08", edad: 6, avatar: "ave", perfil: null, intereses: [] } // aún no juega
];
const ACTIVIDADES = [
  { titulo: "Vocales con animales", habilidad: "vocales", tematica: "animales" },
  { titulo: "Sílabas de la naturaleza", habilidad: "palabras_silabas", tematica: "naturaleza" },
  { titulo: "Vocales de la casa", habilidad: "vocales", tematica: "objetos_cotidianos" }
];

let operacion = 0;
const nuevaOp = (tag) => `demo-${tag}-${++operacion}`;

async function responder(nav, partida, ejercicio, resultado) {
  const intento = (eleccion) => nav.llamar(`/api/partidas/${partida}/intentos`, { metodo: "POST", cuerpo: { ejercicioId: ejercicio.id, eleccion, operacionId: nuevaOp(ejercicio.id) } }).then((r) => exigir(r, "responder"));
  // Las actividades de sílabas no tienen pista: ahí «pista» equivale a acertar a la primera
  if (resultado === "pista" && ejercicio.pista) {
    exigir(await nav.llamar(`/api/partidas/${partida}/pistas`, { metodo: "POST", cuerpo: { ejercicioId: ejercicio.id, operacionId: nuevaOp("pista") } }), "pedir pista");
  }
  if (resultado === "fallo") await intento(eleccionIncorrecta(ejercicio));
  if (resultado === "agotado") {
    await intento(eleccionIncorrecta(ejercicio));
    await intento(eleccionIncorrecta(ejercicio));
    return; // tras dos fallos el servidor avanza solo
  }
  await intento(eleccionCorrecta(ejercicio));
}

async function jugar(nav, estudianteId, actividad, perfil, hasta = 5) {
  const partida = exigir(await nav.llamar("/api/partidas", { metodo: "POST", cuerpo: { estudianteId, juegoId: actividad.juegoId } }), "iniciar partida").id;
  for (let k = 0; k < hasta; k++) await responder(nav, partida, actividad.ejercicios[k], PERFILES[perfil][k]);
  return partida;
}

async function entrar(nav) {
  const registro = await nav.llamar("/api/docentes", { metodo: "POST", cuerpo: { nombre: "Profesora Demo", correo: CORREO, contrasena: CONTRASENA, institucion: "Escuela Demostración" } });
  if (registro.ok) return { nueva: true };
  if (registro.status !== 409) throw new Error(`registrar falló (${registro.status}): ${JSON.stringify(registro.cuerpo)}`);
  exigir(await nav.llamar("/api/docentes/sesion", { metodo: "POST", cuerpo: { correo: CORREO, contrasena: CONTRASENA } }), "iniciar sesión (¿otra contraseña en DEMO_CONTRASENA?)");
  return { nueva: false };
}

// Siembra la demostración con un navegador ya creado. Devuelve un resumen con lo creado.
async function sembrarDemo(nav, { log = () => {} } = {}) {
  const { nueva } = await entrar(nav);
  const cursos = exigir(await nav.llamar("/api/cursos"), "listar cursos");
  if (cursos.length) {
    log("La cuenta de demostración ya tiene datos: no se duplican.");
    return { correo: CORREO, contrasena: CONTRASENA, sembrado: false };
  }
  log(nueva ? "Cuenta creada." : "Cuenta existente sin datos.");

  const curso = exigir(await nav.llamar("/api/cursos", { metodo: "POST", cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } }), "crear curso").id;
  const estudiantes = {};
  for (const e of ESTUDIANTES) {
    estudiantes[e.codigo] = exigir(await nav.llamar("/api/estudiantes", { metodo: "POST", cuerpo: { cursoId: curso, codigoLista: e.codigo, franjaEdad: e.edad, avatarId: e.avatar, intereses: e.intereses } }), `crear ${e.codigo}`).id;
  }
  log(`Curso y ${ESTUDIANTES.length} estudiantes (códigos A01 a A08).`);

  const actividades = [];
  for (const a of ACTIVIDADES) {
    const ejercicios = ejerciciosDe(a.habilidad, a.tematica, 5);
    const juegoId = exigir(await nav.llamar("/api/juegos", { metodo: "POST", cuerpo: { cursoId: curso, titulo: a.titulo, habilidad: a.habilidad } }), "crear actividad").id;
    const version = exigir(await nav.llamar(`/api/juegos/${juegoId}/versiones`, { metodo: "POST", cuerpo: { tematica: a.tematica, cantidadEjercicios: 5, ejercicios } }), "crear versión").id;
    exigir(await nav.llamar(`/api/juegos/${juegoId}/versiones/${version}/aprobar`, { metodo: "POST" }), "aprobar versión");
    actividades.push({ ...a, juegoId, ejercicios });
  }
  log(`${actividades.length} actividades aprobadas.`);

  // La primera tiene una segunda versión, para mostrar el historial (lo jugado antes conserva la versión 1)
  const primera = actividades[0];
  const v2 = exigir(await nav.llamar(`/api/juegos/${primera.juegoId}/versiones`, { metodo: "POST", cuerpo: {
    tematica: primera.tematica, cantidadEjercicios: 5,
    ejercicios: primera.ejercicios.map((e, i) => (i === 0 ? { ...e, consigna: "¿Con qué vocal comienza esta palabra? (1)" } : e))
  } }), "crear versión 2").id;
  // Se juega antes de aprobar la v2, así las primeras partidas quedan en la versión 1
  const partidas = [];
  for (const e of ESTUDIANTES.filter((x) => x.perfil)) {
    partidas.push(await jugar(nav, estudiantes[e.codigo], primera, e.perfil));
  }
  exigir(await nav.llamar(`/api/juegos/${primera.juegoId}/versiones/${v2}/aprobar`, { metodo: "POST" }), "aprobar versión 2");
  for (const actividad of actividades.slice(1)) {
    for (const e of ESTUDIANTES.filter((x) => x.perfil && x.codigo <= "A04")) partidas.push(await jugar(nav, estudiantes[e.codigo], actividad, e.perfil));
  }
  // Una partida a medias (A07 respondió 2 de 5) para mostrar «retomar»
  await jugar(nav, estudiantes.A07, actividades[1], "perfecto", 2);
  log(`${partidas.length} partidas terminadas y 1 a medias.`);

  // Un borrador por revisar (no aprobado) para mostrar la revisión
  const borrador = exigir(await nav.llamar("/api/juegos", { metodo: "POST", cuerpo: { cursoId: curso, titulo: "Sílabas con animales (borrador)", habilidad: "palabras_silabas" } }), "crear borrador").id;
  exigir(await nav.llamar(`/api/juegos/${borrador}/versiones`, { metodo: "POST", cuerpo: { tematica: "animales", cantidadEjercicios: 5, ejercicios: ejerciciosDe("palabras_silabas", "animales", 5) } }), "crear versión del borrador");
  log("1 borrador por revisar.");

  return { correo: CORREO, contrasena: CONTRASENA, sembrado: true, curso, estudiantes, actividades: actividades.map(({ juegoId, titulo }) => ({ juegoId, titulo })), partidasTerminadas: partidas.length, borrador };
}

module.exports = { sembrarDemo, CORREO, CONTRASENA };

if (require.main === module) {
  const url = (process.argv.find((a) => a.startsWith("--url=")) || "").slice(6).replace(/\/+$/, "");
  if (!url) {
    console.error("Falta --url=http://localhost:3977 (la API ya en marcha)");
    process.exit(2);
  }
  sembrarDemo(crearNavegador(url), { log: (m) => console.log(`- ${m}`) })
    .then((r) => {
      console.log(`\nCuenta de demostración: ${r.correo} / ${r.contrasena}`);
      if (!r.sembrado) console.log("(sin cambios)");
    })
    .catch((error) => {
      console.error("No se pudo sembrar:", error.message);
      process.exit(1);
    });
}

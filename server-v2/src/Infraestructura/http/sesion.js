const crypto = require("node:crypto");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { obtenerClienteMongo } = require("../database/Mongo");

// Sesión del docente (§7.4.2, RNF-005). Extensión 1 del marco: middleware global en Infraestructura/http.
// - Cookie HttpOnly, SameSite=Lax y Secure en producción; el navegador nunca ve el id del docente.
// - Se guarda en MongoDB (colección "sesiones") con un adaptador mantenido: sobrevive a reinicios.
// - Expira a las 4 h sin actividad (rolling) o a las 12 h desde que se inició (lo comprueba requerirDocente).
const INACTIVIDAD_MS = 4 * 60 * 60 * 1000;
const DURACION_MAXIMA_MS = 12 * 60 * 60 * 1000;
// Un estudiante vuelve a escribir su código cada 4 h (una jornada de juego, no un día)
const DURACION_ESTUDIANTE_MS = 4 * 60 * 60 * 1000;
const NOMBRE_COOKIE = "letritas.sid";
const CABECERA_CSRF = "x-csrf-token";

const enProduccion = () => process.env.NODE_ENV === "production";

function secreto() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET.split(",");
  if (enProduccion()) throw new Error("Falta SESSION_SECRET: es obligatorio en producción");
  // En desarrollo y pruebas un secreto aleatorio por proceso: reiniciar el servidor cierra las sesiones
  console.warn("SESSION_SECRET no definido: se usa uno temporal (las sesiones se pierden al reiniciar)");
  return [crypto.randomBytes(32).toString("hex")];
}

function crearMiddlewareSesion() {
  return session({
    name: NOMBRE_COOKIE,
    secret: secreto(),
    resave: false,
    saveUninitialized: false, // sin cookie hasta que el docente entra
    rolling: true, // cada petición renueva la expiración por inactividad
    proxy: enProduccion(),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: enProduccion(),
      maxAge: INACTIVIDAD_MS
    },
    store: MongoStore.create({
      clientPromise: obtenerClienteMongo(),
      collectionName: "sesiones",
      ttl: INACTIVIDAD_MS / 1000,
      autoRemove: "native", // índice TTL de MongoDB: borra las vencidas sin temporizadores propios
      touchAfter: 60 // como mucho una escritura por minuto al renovar
    })
  });
}

const promesa = (req, metodo) =>
  new Promise((resolver, rechazar) => req.session[metodo]((error) => (error ? rechazar(error) : resolver())));

// Al entrar o registrarse: id de sesión nuevo (evita la fijación de sesión) y token CSRF nuevo
async function iniciarSesion(req, res, docenteId) {
  await promesa(req, "regenerate");
  req.session.docenteId = docenteId;
  req.session.iniciadaEn = Date.now();
  req.session.csrf = crypto.randomBytes(32).toString("hex");
  await promesa(req, "save");
  enviarTokenCsrf(req, res);
}

// Sesión del estudiante (acceso por código del curso). Vive en la misma cookie, bajo otra clave:
// no da ningún permiso de docente y, si el docente probaba en este navegador, no le cierra su sesión.
async function iniciarSesionEstudiante(req, res, datos) {
  const { docenteId, iniciadaEn, csrf } = req.session || {};
  await promesa(req, "regenerate"); // id nuevo: evita la fijación de sesión
  if (docenteId) Object.assign(req.session, { docenteId, iniciadaEn });
  req.session.csrf = csrf || crypto.randomBytes(32).toString("hex");
  req.session.estudiante = { ...datos, iniciadaEn: Date.now() };
  await promesa(req, "save");
  enviarTokenCsrf(req, res);
}

async function cerrarSesionEstudiante(req) {
  if (!req.session || !req.session.estudiante) return;
  delete req.session.estudiante;
  await promesa(req, "save");
}

// Al salir: se borra del almacén (revocación real, no solo en el navegador) y se limpia la cookie
async function cerrarSesion(req, res) {
  if (req.session) await promesa(req, "destroy");
  res.clearCookie(NOMBRE_COOKIE, { httpOnly: true, sameSite: "lax", secure: enProduccion() });
}

function enviarTokenCsrf(req, res) {
  if (req.session && req.session.csrf) res.set("X-CSRF-Token", req.session.csrf);
}

// Comparación en tiempo constante
function csrfValido(req) {
  const esperado = req.session && req.session.csrf;
  const recibido = req.get(CABECERA_CSRF);
  if (typeof esperado !== "string" || typeof recibido !== "string") return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recibido);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  crearMiddlewareSesion,
  iniciarSesion,
  cerrarSesion,
  iniciarSesionEstudiante,
  cerrarSesionEstudiante,
  enviarTokenCsrf,
  csrfValido,
  DURACION_MAXIMA_MS,
  DURACION_ESTUDIANTE_MS,
  INACTIVIDAD_MS,
  NOMBRE_COOKIE
};

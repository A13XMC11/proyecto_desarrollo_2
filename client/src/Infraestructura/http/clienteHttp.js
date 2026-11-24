// Único lugar del cliente que usa fetch (equivale a database/ en el servidor).
// La identidad viaja en la cookie de sesión HttpOnly (el navegador la envía sola; JavaScript no la ve).
// Las operaciones que cambian datos llevan además el token CSRF que el servidor entrega en X-CSRF-Token.
// En localStorage solo se guarda la vista pública del docente (nombre, correo) para pintar sin esperar;
// no autoriza nada: el servidor decide con la cookie.

const CLAVE_SESION = "letritas.docente";
const METODOS_SEGUROS = ["GET", "HEAD"];

let tokenCsrf = null;

export class ErrorApi extends Error {
  constructor(mensaje, { estado, codigo } = {}) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

export const leerSesionGuardada = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION)) || null;
  } catch {
    return null;
  }
};

export const guardarSesion = (docente) => {
  if (!docente) tokenCsrf = null;
  try {
    if (docente) localStorage.setItem(CLAVE_SESION, JSON.stringify(docente));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* sin almacenamiento la sesión dura lo que la pestaña */
  }
};

// Avisa a la app cuando el servidor rechaza la identidad (401): la sesión se cierra en un solo sitio
let alExpirar = () => {};
export const registrarAlExpirar = (funcion) => {
  alExpirar = funcion;
};

const MENSAJES_POR_ESTADO = {
  0: "No hay conexión con el servidor. Revisa tu internet e inténtalo otra vez.",
  404: "No encontramos lo que buscabas. Puede que se haya archivado.",
  429: "Llegaste al límite por ahora. Prueba más tarde.",
  500: "Algo falló en el servidor. Inténtalo de nuevo en un momento."
};

// 502-504 sin cuerpo de la API los da el proxy cuando el servidor no responde: es falta de conexión. Si la
// respuesta trae el mensaje de la API (p. ej. un 503 porque una base de datos cayó), ese mensaje es el bueno.
export const esFaltaDeConexion = (estado, datos) => estado >= 502 && estado <= 504 && !(datos && datos.message);

const enviar = async (url, metodo, cuerpo, cabeceras) => {
  try {
    const respuesta = await fetch(url, {
      method: metodo,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(cuerpo !== undefined && { "Content-Type": "application/json" }),
        ...(!METODOS_SEGUROS.includes(metodo) && tokenCsrf && { "X-CSRF-Token": tokenCsrf }),
        ...cabeceras
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
    // El servidor entrega el token al entrar, al registrarse y al consultar la sesión
    const nuevo = respuesta.headers.get("X-CSRF-Token");
    if (nuevo) tokenCsrf = nuevo;
    return respuesta;
  } catch {
    throw new ErrorApi(MENSAJES_POR_ESTADO[0], { estado: 0 });
  }
};

const esCsrfInvalido = async (respuesta) =>
  respuesta.status === 403 && (await respuesta.clone().json().catch(() => null))?.codigo === "CSRF_INVALIDO";

export const pedir = async (ruta, { metodo = "GET", cuerpo, consulta, cabeceras = {} } = {}) => {
  const url = new URL(`/api${ruta}`, window.location.origin);
  Object.entries(consulta || {}).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") url.searchParams.set(clave, valor);
  });

  const habiaSesion = Boolean(leerSesionGuardada());
  let respuesta = await enviar(url, metodo, cuerpo, cabeceras);

  // Token perdido (recarga antes de recuperar la sesión) o renovado en otra pestaña: se pide y se reintenta una vez
  if (await esCsrfInvalido(respuesta)) {
    await enviar(new URL("/api/docentes/sesion", window.location.origin), "GET");
    respuesta = await enviar(url, metodo, cuerpo, cabeceras);
  }

  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && habiaSesion) alExpirar();
    if (esFaltaDeConexion(respuesta.status, datos)) throw new ErrorApi(MENSAJES_POR_ESTADO[0], { estado: 0 });
    const mensaje = (datos && datos.message) || MENSAJES_POR_ESTADO[respuesta.status] || MENSAJES_POR_ESTADO[500];
    throw new ErrorApi(mensaje, { estado: respuesta.status, codigo: datos && datos.codigo });
  }
  return datos;
};

// Identificador para operaciones idempotentes (intentos, pistas, generaciones)
export const nuevoIdOperacion = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

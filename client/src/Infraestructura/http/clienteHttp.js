// Único lugar del cliente que usa fetch (equivale a database/ en el servidor).
// Mientras el servidor no tenga sesión con cookie, el docente se identifica con la cabecera x-docente-id.

const CLAVE_SESION = "letritas.docente";

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

export const pedir = async (ruta, { metodo = "GET", cuerpo, consulta, cabeceras = {} } = {}) => {
  const url = new URL(`/api${ruta}`, window.location.origin);
  Object.entries(consulta || {}).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") url.searchParams.set(clave, valor);
  });

  const docente = leerSesionGuardada();
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: {
        Accept: "application/json",
        ...(cuerpo !== undefined && { "Content-Type": "application/json" }),
        ...(docente && { "x-docente-id": docente.id }),
        ...cabeceras
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
  } catch {
    throw new ErrorApi(MENSAJES_POR_ESTADO[0], { estado: 0 });
  }

  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && docente) alExpirar();
    // 502-504 los da el proxy cuando el servidor no responde: es falta de conexión, no un error de datos
    if (respuesta.status >= 502 && respuesta.status <= 504) throw new ErrorApi(MENSAJES_POR_ESTADO[0], { estado: 0 });
    const mensaje = (datos && datos.message) || MENSAJES_POR_ESTADO[respuesta.status] || MENSAJES_POR_ESTADO[500];
    throw new ErrorApi(mensaje, { estado: respuesta.status, codigo: datos && datos.codigo });
  }
  return datos;
};

// Identificador para operaciones idempotentes (intentos, pistas, generaciones)
export const nuevoIdOperacion = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

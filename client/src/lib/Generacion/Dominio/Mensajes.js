import { MENSAJES_CONTENIDO, MOTIVOS_GENERACION } from "../../Juego/Dominio/ValoresPermitidos.js";

// Mensaje para el docente según el código que devuelve el servidor. Los de contenido bloqueado son siempre
// fijos: nunca repiten lo que escribió el docente ni lo que diga el servidor.
const POR_CODIGO = { ...MOTIVOS_GENERACION, ...MENSAJES_CONTENIDO };

export const mensajeDeError = (error) => {
  if (!error) return "Algo salió mal.";
  if (error.estado === 0) return error.message;
  return POR_CODIGO[error.codigo] || error.message || "Algo salió mal.";
};

import { MENSAJES_CONTENIDO, MOTIVOS_GENERACION } from "../../Juego/Dominio/ValoresPermitidos.js";

// Mensaje para el docente según el código que devuelve el servidor. Los de contenido bloqueado son siempre
// fijos: nunca repiten lo que escribió el docente ni lo que diga el servidor.
const POR_CODIGO = { ...MOTIVOS_GENERACION, ...MENSAJES_CONTENIDO };

// Nombres que ve el docente para los campos que el servidor nombra tal cual en su validación («consigna requerido»)
const NOMBRES_CAMPO = { consigna: "la consigna", titulo: "el título", pista: "la pista", tematica: "la temática", nombre: "el nombre" };

const campoRequerido = (error) => {
  if (error.codigo !== "ENTRADA_INVALIDA") return null;
  const campo = /^(\w+) requerido$/.exec(error.message || "")?.[1];
  return campo ? `Falta completar ${NOMBRES_CAMPO[campo] || `el campo «${campo}»`}. Revisa ese campo en el editor y vuelve a intentarlo.` : null;
};

export const mensajeDeError = (error) => {
  if (!error) return "Algo salió mal.";
  if (error.estado === 0) return error.message;
  const faltante = campoRequerido(error);
  if (faltante) return faltante;
  return POR_CODIGO[error.codigo] || error.message || "Algo salió mal.";
};

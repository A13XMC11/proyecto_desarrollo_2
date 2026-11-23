import { TEMATICAS } from "./ValoresPermitidos.js";

// Cómo se nombra la temática de una actividad o de una solicitud: { modoTematica, tematica }.
// Sin modo es del catálogo (las actividades guardadas antes de la temática libre no lo traen).
export const esLibre = (config) => config?.modoTematica === "libre";

export const nombreTematica = (config) => {
  if (!config) return "";
  return esLibre(config) ? `Temática libre: ${config.tematica}` : TEMATICAS[config.tematica] || config.tematica || "";
};

// Etiqueta para distinguir en la biblioteca las de temática libre; las del catálogo no llevan etiqueta
export const etiquetaTematica = (config) => (esLibre(config) ? nombreTematica(config) : null);

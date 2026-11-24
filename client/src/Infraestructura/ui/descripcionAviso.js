// Cómo se anuncia un aviso breve. Un error nunca depende solo del color: lleva icono, texto y la palabra «Error»
// para quien usa lector de pantalla, y se anuncia de inmediato (role alert); el éxito se anuncia con calma.
const DESCRIPCIONES = {
  error: { rol: "alert", region: "assertive", prefijo: "Error: " },
  exito: { rol: "status", region: "polite", prefijo: "Listo: " }
};

export const describirAviso = (tipo) => DESCRIPCIONES[tipo] || DESCRIPCIONES.exito;

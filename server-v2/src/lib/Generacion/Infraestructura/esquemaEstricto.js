// OpenAI en modo estricto (Structured Outputs) exige que todo objeto declare additionalProperties:false y que
// TODAS sus propiedades estén en required (lo opcional se expresa admitiendo null). Los esquemas del proyecto
// se escriben una sola vez, de forma natural; este archivo los adapta y limpia la respuesta.
//
// Se quitan minLength y maxLength: el soporte de esas palabras en modo estricto no está confirmado y un
// esquema rechazado haría fallar TODAS las llamadas. No se pierde seguridad: el servidor vuelve a validar
// cada longitud (la respuesta de la IA es una propuesta no confiable).
const PALABRAS_QUITADAS = ["minLength", "maxLength"];

const admiteNulo = (esquema) => {
  const tipo = Array.isArray(esquema.type) ? esquema.type : [esquema.type];
  return {
    ...esquema,
    type: tipo.includes("null") ? tipo : [...tipo, "null"],
    ...(Array.isArray(esquema.enum) && !esquema.enum.includes(null) && { enum: [...esquema.enum, null] })
  };
};

// Devuelve un esquema nuevo (no muta el original)
function adaptarEsquemaEstricto(esquema) {
  if (Array.isArray(esquema)) return esquema.map(adaptarEsquemaEstricto);
  if (!esquema || typeof esquema !== "object") return esquema;

  const copia = {};
  for (const [clave, valor] of Object.entries(esquema)) {
    if (PALABRAS_QUITADAS.includes(clave)) continue;
    if (clave === "properties") continue; // se arma abajo
    copia[clave] = clave === "items" ? adaptarEsquemaEstricto(valor) : valor;
  }

  if (esquema.type === "object" && esquema.properties) {
    const obligatorias = new Set(esquema.required || []);
    copia.properties = {};
    for (const [nombre, hijo] of Object.entries(esquema.properties)) {
      const adaptado = adaptarEsquemaEstricto(hijo);
      copia.properties[nombre] = obligatorias.has(nombre) ? adaptado : admiteNulo(adaptado);
    }
    copia.required = Object.keys(esquema.properties);
    copia.additionalProperties = false;
  }
  return copia;
}

// El esquema estricto hace que la IA rellene con null lo opcional: se quita para que el resto del generador
// vea esos campos como ausentes, igual que con los demás proveedores.
function quitarNulos(valor) {
  if (Array.isArray(valor)) return valor.map(quitarNulos);
  if (!valor || typeof valor !== "object") return valor;
  return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== null).map(([k, v]) => [k, quitarNulos(v)]));
}

module.exports = { adaptarEsquemaEstricto, quitarNulos };

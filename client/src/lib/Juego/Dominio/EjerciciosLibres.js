// Edición de un borrador de temática libre. La palabra, las sílabas, las opciones y la respuesta correcta las calculó
// el servidor: el docente solo puede corregir la consigna, la pista y el icono. El servidor vuelve a validar al guardar.

const MAX_CONSIGNA = 140;
const MAX_PISTA = 100;

// La palabra del ejercicio: la declarada (completar y ordenar) o el objetivo (vocales y contar)
export const palabraDe = (e) => e.palabraId || e.objetivo;

// La respuesta correcta como texto, para que el docente la revise
export const respuestaDe = (e) => {
  if (e.opciones) return e.opciones.find((o) => o.id === e.respuestaCorrectaId)?.texto ?? "";
  return (e.ordenCorrecto || []).map((id) => e.piezas.find((p) => p.id === id)?.texto ?? "").join("-");
};

export const aFormularioLibre = (ejercicios = []) =>
  ejercicios.map((e) => ({
    id: e.id,
    palabra: palabraDe(e),
    respuesta: respuestaDe(e),
    consigna: e.consigna,
    pista: e.pista || "",
    icono: e.icono || ""
  }));

// Parte siempre del ejercicio original: nada que no sea consigna, pista o icono puede cambiar
export const aContratoLibre = (formulario, originales) =>
  originales.map((original, i) => {
    const { pista, icono, ...resto } = original;
    const f = formulario[i];
    return {
      ...resto,
      consigna: f.consigna.trim(),
      ...(f.pista.trim() && { pista: f.pista.trim() }),
      ...(f.icono && { icono: f.icono })
    };
  });

export const revisarLibre = (formulario) =>
  formulario.map((f) => {
    const errores = {};
    if (!f.consigna.trim()) errores.consigna = "La consigna no puede quedar vacía.";
    else if (f.consigna.trim().length > MAX_CONSIGNA) errores.consigna = `La consigna admite hasta ${MAX_CONSIGNA} caracteres.`;
    if (f.pista.trim().length > MAX_PISTA) errores.pista = `La pista admite hasta ${MAX_PISTA} caracteres.`;
    return errores;
  });

// Iconos de una categoría (o todos, sin categoría), a partir de la lista que entrega el servidor
export const iconosDe = (categorias, clave) => {
  if (!Array.isArray(categorias)) return [];
  if (!clave) return categorias.flatMap((c) => c.iconos);
  return categorias.find((c) => c.clave === clave)?.iconos ?? [];
};

// Vista previa de un borrador "como lo verá el estudiante", sin crear partida ni registrar resultados.
// En el modo aula el servidor mezcla y corrige; aquí el docente prueba su propio borrador, así que la
// comprobación se hace en el navegador con los datos que él mismo está editando.

const mezclar = (lista) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

// Igual que el servidor: las piezas nunca aparecen ya ordenadas
const mezclarPiezas = (piezas, ordenCorrecto) => {
  const mezcla = mezclar(piezas);
  const resuelta = mezcla.length > 1 && mezcla.every((p, i) => p.id === ordenCorrecto[i]);
  return resuelta ? [...mezcla.slice(1), mezcla[0]] : mezcla;
};

// Contrato de ejercicios -> ejercicios con la forma del modo aula (más la solución, que el aula no recibe)
export const aVistaPrevia = (ejercicios) =>
  ejercicios.map((e) => {
    const base = { id: e.id, consigna: e.consigna, objetivo: e.objetivo, icono: e.icono, pista: e.pista };
    return e.opciones
      ? { ...base, tipo: "seleccionar_opcion", opciones: mezclar(e.opciones), respuesta: e.respuestaCorrectaId }
      : { ...base, tipo: "ordenar_silabas", piezas: mezclarPiezas(e.piezas, e.ordenCorrecto), respuesta: e.ordenCorrecto };
  });

export const esCorrecta = (ejercicio, eleccion) =>
  ejercicio.tipo === "seleccionar_opcion"
    ? eleccion === ejercicio.respuesta
    : Array.isArray(eleccion) && eleccion.length === ejercicio.respuesta.length && eleccion.every((id, i) => id === ejercicio.respuesta[i]);

// Como en el aula: dos intentos por ejercicio; después se muestra la solución
export const MAXIMO_INTENTOS = 2;

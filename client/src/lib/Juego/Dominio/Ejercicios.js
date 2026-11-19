// Conversión entre el formulario del editor y el contrato de ejercicios del servidor.
// Las palabras salen del catálogo (GET /api/recursos): el docente elige un recurso y de él se toman la palabra,
// la vocal inicial y las sílabas aprobadas. El servidor vuelve a validar todo.

const VOCALES = ["A", "E", "I", "O", "U"];
const sinTildes = (t) => t.normalize("NFD").replace(/\p{M}/gu, "");
const normalizar = (t) => sinTildes(t).trim().toLowerCase();

export const CONSIGNA_VOCALES = "¿Con qué vocal empieza esta palabra?";
export const CONSIGNA_SILABAS = "Ordena las sílabas para formar la palabra";

// Sugiere la vocal correcta (la del recurso) y dos distractoras distintas
export const sugerirOpciones = (recurso) => {
  const correcta = recurso?.vocalInicial?.toUpperCase();
  if (!correcta) return null;
  const otras = VOCALES.filter((v) => v !== correcta).sort(() => Math.random() - 0.5).slice(0, 2);
  const opciones = [correcta, ...otras].sort();
  return { opciones, correcta: opciones.indexOf(correcta) };
};

export const ejercicioVacio = (mecanica) =>
  mecanica === "seleccionar_opcion"
    ? { recursoId: "", consigna: CONSIGNA_VOCALES, pista: "", opciones: ["", "", ""], correcta: 0 }
    : { recursoId: "", consigna: CONSIGNA_SILABAS, pista: "" };

// Recursos que sirven para cada mecánica: las vocales exigen una palabra que empiece con vocal
export const recursosPara = (recursos, mecanica) =>
  [...recursos]
    .filter((r) => mecanica !== "seleccionar_opcion" || r.vocalInicial)
    .sort((a, b) => a.palabra.localeCompare(b.palabra, "es"));

// Formulario -> contrato del servidor
export const aContrato = (formulario, mecanica, recursos) => {
  const porId = new Map(recursos.map((r) => [r.id, r]));
  return formulario.map((f, i) => {
    const recurso = porId.get(f.recursoId);
    if (!recurso) throw new Error("Elige una palabra del catálogo en cada ejercicio.");
    const base = {
      id: `e${i + 1}`,
      consigna: f.consigna.trim(),
      objetivo: recurso.palabra,
      ...(f.pista.trim() && { pista: f.pista.trim() })
    };
    if (mecanica === "seleccionar_opcion") {
      return {
        ...base,
        recursoId: recurso.id,
        opciones: f.opciones.map((texto, j) => ({ id: `o${j + 1}`, texto: texto.trim() })),
        respuestaCorrectaId: `o${f.correcta + 1}`
      };
    }
    const piezas = recurso.silabas.map((texto, j) => ({ id: `p${j + 1}`, texto }));
    return { ...base, palabraId: recurso.id, piezas, ordenCorrecto: piezas.map((p) => p.id) };
  });
};

// Contrato del servidor -> formulario
export const aFormulario = (ejercicios = []) =>
  ejercicios.map((e) => {
    const comun = { consigna: e.consigna, pista: e.pista || "" };
    return e.opciones
      ? {
          ...comun,
          recursoId: e.recursoId || "",
          opciones: e.opciones.map((o) => o.texto || ""),
          correcta: Math.max(0, e.opciones.findIndex((o) => o.id === e.respuestaCorrectaId))
        }
      : { ...comun, recursoId: e.palabraId || "" };
  });

// Problemas que el docente puede corregir antes de enviar; el servidor vuelve a validar todo
export const revisar = (formulario, mecanica, recursos) => {
  const porId = new Map(recursos.map((r) => [r.id, r]));
  const vistos = new Set();
  return formulario.map((f) => {
    const errores = {};
    const recurso = porId.get(f.recursoId);
    if (!f.recursoId) errores.recursoId = "Elige una palabra del catálogo.";
    else if (!recurso) errores.recursoId = "Esa palabra no está en el catálogo de esta temática. Elige otra.";
    if (!f.consigna.trim()) errores.consigna = "La consigna no puede quedar vacía.";

    if (mecanica === "seleccionar_opcion") {
      const textos = f.opciones.map((o) => o.trim().toLowerCase());
      if (textos.some((t) => !t)) errores.opciones = "Completa las tres opciones.";
      else if (new Set(textos).size !== 3) errores.opciones = "Las opciones no pueden repetirse.";
      else if (recurso && normalizar(f.opciones[f.correcta]) !== recurso.vocalInicial) {
        errores.opciones = `La respuesta correcta debe ser la vocal con la que empieza la palabra (${recurso.vocalInicial.toUpperCase()}).`;
      }
    }

    // El servidor rechaza dos ejercicios con la misma consigna y la misma respuesta
    const respuesta = mecanica === "seleccionar_opcion" ? recurso?.vocalInicial : recurso?.id;
    if (respuesta && f.consigna.trim()) {
      const clave = `${normalizar(f.consigna)}|${respuesta}`;
      if (vistos.has(clave)) errores.consigna = "Otro ejercicio tiene la misma consigna y la misma respuesta. Cambia la consigna o la palabra.";
      vistos.add(clave);
    }
    return errores;
  });
};

// Conversión entre el formulario del editor y el contrato de ejercicios del servidor.
// Es la única regla propia del cliente en este módulo: cómo se arma un ejercicio desde lo que escribe el docente.

const VOCALES = ["A", "E", "I", "O", "U"];
const sinTildes = (t) => t.normalize("NFD").replace(/\p{M}/gu, "");

export const CONSIGNA_VOCALES = "¿Con qué vocal empieza esta palabra?";
export const CONSIGNA_SILABAS = "Ordena las sílabas para formar la palabra";

export const vocalInicial = (palabra) => {
  const letra = sinTildes(palabra.trim()).charAt(0).toUpperCase();
  return VOCALES.includes(letra) ? letra : null;
};

// Sugiere la vocal correcta y dos distractoras distintas
export const sugerirOpciones = (palabra) => {
  const correcta = vocalInicial(palabra);
  if (!correcta) return null;
  const otras = VOCALES.filter((v) => v !== correcta).sort(() => Math.random() - 0.5).slice(0, 2);
  const opciones = [correcta, ...otras].sort();
  return { opciones, correcta: opciones.indexOf(correcta) };
};

export const ejercicioVacio = (mecanica) =>
  mecanica === "seleccionar_opcion"
    ? { palabra: "", consigna: CONSIGNA_VOCALES, pista: "", opciones: ["", "", ""], correcta: 0 }
    : { palabra: "", consigna: CONSIGNA_SILABAS, pista: "", silabas: "" };

export const separarSilabas = (texto) =>
  texto.split(/[-\s·.]+/).map((s) => s.trim()).filter(Boolean);

const slug = (texto) => sinTildes(texto).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "palabra";

// Formulario -> contrato del servidor
export const aContrato = (formulario, mecanica) =>
  formulario.map((f, i) => {
    const base = {
      id: `e${i + 1}`,
      consigna: f.consigna.trim(),
      objetivo: f.palabra.trim(),
      ...(f.pista.trim() && { pista: f.pista.trim() })
    };
    if (mecanica === "seleccionar_opcion") {
      return {
        ...base,
        opciones: f.opciones.map((texto, j) => ({ id: `o${j + 1}`, texto: texto.trim() })),
        respuestaCorrectaId: `o${f.correcta + 1}`
      };
    }
    const piezas = separarSilabas(f.silabas).map((texto, j) => ({ id: `p${j + 1}`, texto }));
    return { ...base, palabraId: slug(f.palabra), piezas, ordenCorrecto: piezas.map((p) => p.id) };
  });

// Contrato del servidor -> formulario
export const aFormulario = (ejercicios = []) =>
  ejercicios.map((e) =>
    e.opciones
      ? {
          palabra: e.objetivo || "",
          consigna: e.consigna,
          pista: e.pista || "",
          opciones: e.opciones.map((o) => o.texto || ""),
          correcta: Math.max(0, e.opciones.findIndex((o) => o.id === e.respuestaCorrectaId))
        }
      : {
          palabra: e.objetivo || "",
          consigna: e.consigna,
          pista: e.pista || "",
          silabas: (e.ordenCorrecto || []).map((id) => e.piezas.find((p) => p.id === id)?.texto).filter(Boolean).join("-")
        }
  );

// Problemas que el docente puede corregir antes de enviar; el servidor vuelve a validar todo
export const revisar = (formulario, mecanica) =>
  formulario.map((f) => {
    const errores = {};
    if (!f.palabra.trim()) errores.palabra = "Escribe la palabra.";
    if (!f.consigna.trim()) errores.consigna = "La consigna no puede quedar vacía.";
    if (mecanica === "seleccionar_opcion") {
      const textos = f.opciones.map((o) => o.trim().toLowerCase());
      if (textos.some((t) => !t)) errores.opciones = "Completa las tres opciones.";
      else if (new Set(textos).size !== 3) errores.opciones = "Las opciones no pueden repetirse.";
    } else {
      const silabas = separarSilabas(f.silabas);
      if (silabas.length < 2) errores.silabas = "Separa al menos dos sílabas con guiones: ga-to.";
      else if (silabas.some((s) => s.length > 10)) errores.silabas = "Cada sílaba admite hasta 10 letras.";
      else if (sinTildes(silabas.join("")).toLowerCase() !== sinTildes(f.palabra.trim()).toLowerCase())
        errores.silabas = "Las sílabas juntas deben formar la palabra.";
    }
    return errores;
  });

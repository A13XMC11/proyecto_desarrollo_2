// Conversión entre el formulario del editor y el contrato de ejercicios del servidor.
// Las palabras salen del catálogo (GET /api/recursos): el docente elige un recurso y de él se toman la palabra,
// la vocal inicial, las sílabas aprobadas y el icono. El servidor vuelve a validar todo.

const VOCALES = ["A", "E", "I", "O", "U"];
const MARCA_HUECO = "__";
const MAX_SILABAS_ORDENAR = 3;
const MAX_SILABAS_LEER = 4;
const sinTildes = (t) => t.normalize("NFD").replace(/\p{M}/gu, "");
const normalizar = (t) => sinTildes(t).trim().toLowerCase();
const alfabetico = (a, b) => a.localeCompare(b, "es");
const conIcono = (recurso) => (recurso?.icono ? { icono: recurso.icono } : {});

export const CONSIGNA_VOCALES = "¿Con qué vocal empieza esta palabra?";
export const CONSIGNA_SILABAS = "Ordena las sílabas para formar la palabra";
export const CONSIGNA_COMPLETAR = "¿Qué sílaba falta en la palabra?";
export const CONSIGNA_CONTAR = "¿Cuántas sílabas tiene la palabra?";

// Las habilidades que se responden eligiendo entre tres opciones
export const usaOpciones = (habilidad) => habilidad !== "palabras_silabas";

// Sugiere la vocal correcta (la del recurso) y dos distractoras distintas
export const sugerirOpciones = (recurso) => {
  const correcta = recurso?.vocalInicial?.toUpperCase();
  if (!correcta) return null;
  const otras = VOCALES.filter((v) => v !== correcta).sort(() => Math.random() - 0.5).slice(0, 2);
  const opciones = [correcta, ...otras].sort();
  return { opciones, correcta: opciones.indexOf(correcta) };
};

// Completar sílaba: la correcta (la del hueco) y dos sílabas de otras palabras, del mismo largo si es posible.
// Nunca las que ya se ven en la palabra: serían descartables a simple vista.
export const sugerirOpcionesCompletar = (recurso, indice, recursos = []) => {
  const correcta = recurso?.silabas?.[indice];
  if (!correcta) return null;
  const excluidas = new Set(recurso.silabas.map(normalizar));
  const todas = [...new Set(recursos.flatMap((r) => r.silabas))].filter((s) => !excluidas.has(normalizar(s)));
  const parecidas = todas.filter((s) => s.length === correcta.length);
  const candidatas = (parecidas.length >= 2 ? parecidas : todas).sort(() => Math.random() - 0.5).slice(0, 2);
  if (candidatas.length < 2) return null;
  const opciones = [correcta, ...candidatas].sort(alfabetico);
  return { opciones, correcta: opciones.indexOf(correcta) };
};

// Contar sílabas: tres números seguidos que contienen la cantidad real
export const sugerirOpcionesConteo = (recurso) => {
  if (!recurso?.silabas) return null;
  const primero = Math.max(1, recurso.silabas.length - 1);
  const opciones = [primero, primero + 1, primero + 2].map(String);
  return { opciones, correcta: opciones.indexOf(String(recurso.silabas.length)) };
};

// Opciones que se proponen al elegir la palabra (o la sílaba que falta), según la habilidad
export const sugerirSegunHabilidad = (habilidad, recurso, { indice = 0, recursos = [] } = {}) => {
  if (habilidad === "vocales") return sugerirOpciones(recurso);
  if (habilidad === "completar_silaba") return sugerirOpcionesCompletar(recurso, indice, recursos);
  if (habilidad === "contar_silabas") return sugerirOpcionesConteo(recurso);
  return null;
};

const CONSIGNAS = {
  vocales: CONSIGNA_VOCALES,
  palabras_silabas: CONSIGNA_SILABAS,
  completar_silaba: CONSIGNA_COMPLETAR,
  contar_silabas: CONSIGNA_CONTAR
};

export const ejercicioVacio = (habilidad) => ({
  recursoId: "",
  consigna: CONSIGNAS[habilidad] || CONSIGNA_SILABAS,
  pista: "",
  ...(usaOpciones(habilidad) && { opciones: ["", "", ""], correcta: 0 }),
  ...(habilidad === "completar_silaba" && { indice: 0 })
});

// Recursos que sirven para cada habilidad: las vocales exigen una palabra que empiece con vocal;
// ordenar admite hasta 3 piezas; completar y contar, hasta 4 sílabas
export const recursosPara = (recursos, habilidad) =>
  [...recursos]
    .filter((r) => {
      if (habilidad === "vocales") return Boolean(r.vocalInicial);
      if (habilidad === "palabras_silabas") return r.silabas.length <= MAX_SILABAS_ORDENAR;
      return r.silabas.length <= MAX_SILABAS_LEER;
    })
    .sort((a, b) => a.palabra.localeCompare(b.palabra, "es"));

const opcionesDeContrato = (f) => ({
  opciones: f.opciones.map((texto, j) => ({ id: `o${j + 1}`, texto: texto.trim() })),
  respuestaCorrectaId: `o${f.correcta + 1}`
});

// Formulario -> contrato del servidor
export const aContrato = (formulario, habilidad, recursos) => {
  const porId = new Map(recursos.map((r) => [r.id, r]));
  return formulario.map((f, i) => {
    const recurso = porId.get(f.recursoId);
    if (!recurso) throw new Error("Elige una palabra del catálogo en cada ejercicio.");
    const base = {
      id: `e${i + 1}`,
      consigna: f.consigna.trim(),
      objetivo: recurso.palabra,
      ...(f.pista.trim() && { pista: f.pista.trim() }),
      ...conIcono(recurso)
    };
    if (habilidad === "completar_silaba") {
      const objetivo = recurso.silabas.map((s, j) => (j === f.indice ? MARCA_HUECO : s)).join(" ");
      return { ...base, objetivo, recursoId: recurso.id, ...opcionesDeContrato(f) };
    }
    if (usaOpciones(habilidad)) return { ...base, recursoId: recurso.id, ...opcionesDeContrato(f) };
    const piezas = recurso.silabas.map((texto, j) => ({ id: `p${j + 1}`, texto }));
    return { ...base, palabraId: recurso.id, piezas, ordenCorrecto: piezas.map((p) => p.id) };
  });
};

// Contrato del servidor -> formulario
export const aFormulario = (ejercicios = []) =>
  ejercicios.map((e) => {
    const comun = { consigna: e.consigna, pista: e.pista || "" };
    if (!e.opciones) return { ...comun, recursoId: e.palabraId || "" };
    const hueco = typeof e.objetivo === "string" ? e.objetivo.split(/\s+/).indexOf(MARCA_HUECO) : -1;
    return {
      ...comun,
      recursoId: e.recursoId || "",
      opciones: e.opciones.map((o) => o.texto || ""),
      correcta: Math.max(0, e.opciones.findIndex((o) => o.id === e.respuestaCorrectaId)),
      ...(hueco >= 0 && { indice: hueco })
    };
  });

// Texto que debe tener la respuesta correcta según la habilidad (null si no se puede saber todavía)
const respuestaEsperada = (habilidad, recurso, f) => {
  if (!recurso) return null;
  if (habilidad === "vocales") return recurso.vocalInicial ?? null;
  if (habilidad === "completar_silaba") return recurso.silabas[f.indice] ?? null;
  if (habilidad === "contar_silabas") return String(recurso.silabas.length);
  return null;
};

const MENSAJES_RESPUESTA = {
  vocales: (r) => `La respuesta correcta debe ser la vocal con la que empieza la palabra (${r.vocalInicial?.toUpperCase()}).`,
  completar_silaba: (r, f) => `La respuesta correcta debe ser la sílaba que falta («${r.silabas[f.indice]}»).`,
  contar_silabas: (r) => `La respuesta correcta debe ser el número de sílabas de la palabra (${r.silabas.length}).`
};

// Problemas que el docente puede corregir antes de enviar; el servidor vuelve a validar todo
export const revisar = (formulario, habilidad, recursos) => {
  const porId = new Map(recursos.map((r) => [r.id, r]));
  const vistos = new Set();
  return formulario.map((f) => {
    const errores = {};
    const recurso = porId.get(f.recursoId);
    if (!f.recursoId) errores.recursoId = "Elige una palabra del catálogo.";
    else if (!recurso) errores.recursoId = "Esa palabra no está en el catálogo de esta temática. Elige otra.";
    if (!f.consigna.trim()) errores.consigna = "La consigna no puede quedar vacía.";

    if (usaOpciones(habilidad)) {
      const textos = f.opciones.map((o) => o.trim().toLowerCase());
      const esperada = respuestaEsperada(habilidad, recurso, f);
      if (textos.some((t) => !t)) errores.opciones = "Completa las tres opciones.";
      else if (new Set(textos).size !== 3) errores.opciones = "Las opciones no pueden repetirse.";
      else if (habilidad === "contar_silabas" && f.opciones.some((o) => !/^[1-9]$/.test(o.trim()))) {
        errores.opciones = "Las opciones deben ser números del 1 al 9.";
      } else if (esperada !== null && normalizar(f.opciones[f.correcta]) !== normalizar(esperada)) {
        errores.opciones = MENSAJES_RESPUESTA[habilidad](recurso, f);
      }
    }

    // El servidor rechaza dos ejercicios con la misma consigna y la misma respuesta
    const respuesta = habilidad === "vocales" ? recurso?.vocalInicial
      : habilidad === "completar_silaba" ? recurso && `${recurso.id}:${normalizar(recurso.silabas[f.indice] ?? "")}`
        : recurso?.id;
    if (respuesta && f.consigna.trim()) {
      const clave = `${normalizar(f.consigna)}|${respuesta}`;
      if (vistos.has(clave)) errores.consigna = "Otro ejercicio tiene la misma consigna y la misma respuesta. Cambia la consigna o la palabra.";
      vistos.add(clave);
    }
    return errores;
  });
};

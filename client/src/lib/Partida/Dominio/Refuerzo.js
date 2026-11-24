// Enlace del panel «¿Qué repasar?» al formulario de crear con IA, con la habilidad y las palabras ya puestas.
// Solo arma un enlace: la actividad la sigue pidiendo y aprobando el docente.
const MAX_ENLACES = 3;
const MAX_PALABRAS = 5;
const MAX_INSTRUCCION = 500;
// Una palabra de verdad: los ejercicios de «completar la sílaba» guardan un patrón con hueco que no sirve de instrucción
const ES_PALABRA = /^\p{L}{2,30}$/u;

export const habilidadesParaReforzar = ({ habilidades = [], palabras = [] }) => [
  ...new Set([...habilidades.filter((h) => h.repasar).map((h) => h.habilidad), ...palabras.map((p) => p.habilidad)])
].slice(0, MAX_ENLACES);

export const enlaceRefuerzo = ({ habilidad, palabras = [], cursoId }) => {
  const parametros = new URLSearchParams({ habilidad });
  if (cursoId) parametros.set("curso", cursoId);
  const lista = palabras.filter((p) => p.habilidad === habilidad && ES_PALABRA.test(p.objetivo)).slice(0, MAX_PALABRAS).map((p) => p.objetivo);
  if (lista.length) parametros.set("instruccion", `Reforzar estas palabras: ${lista.join(", ")}`.slice(0, MAX_INSTRUCCION));
  return `/panel/crear?${parametros}`;
};

// Lo que trae el enlace, validado: la habilidad debe existir y la instrucción se recorta al máximo permitido
export const leerRefuerzo = (parametros, habilidadesValidas) => {
  const habilidad = parametros.get("habilidad");
  const cursoId = parametros.get("curso");
  const instruccion = (parametros.get("instruccion") || "").trim().slice(0, MAX_INSTRUCCION);
  return {
    ...(habilidadesValidas.includes(habilidad) && { habilidad }),
    ...(cursoId && { cursoId }),
    ...(instruccion && { instruccion })
  };
};

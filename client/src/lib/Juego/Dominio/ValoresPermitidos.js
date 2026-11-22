// Espejo de server-v2/src/lib/Compartido/Dominio/ValoresPermitidos.js con los textos para la interfaz.
// El servidor sigue siendo quien valida: esto solo arma formularios y etiquetas.

export const GRADOS = ["1.º EGB", "2.º EGB", "3.º EGB"];
export const FRANJAS_EDAD = [5, 6, 7];
// El servidor habilita 10 ejercicios solo con PERMITIR_10_EJERCICIOS; la primera versión usa 5
export const CANTIDADES_EJERCICIOS = [5];

export const HABILIDADES = {
  vocales: { texto: "Vocales", mecanica: "seleccionar_opcion", mecanicaTexto: "Elegir la respuesta" },
  palabras_silabas: { texto: "Palabras con sílabas", mecanica: "ordenar_silabas", mecanicaTexto: "Ordenar sílabas" }
};

export const TEMATICAS = {
  animales: "Animales",
  objetos_cotidianos: "Objetos de casa",
  naturaleza: "Naturaleza"
};

export const ESTADOS_JUEGO = {
  borrador: { texto: "Borrador", tono: "ambar" },
  listo: { texto: "Lista", tono: "verde" },
  archivado: { texto: "Archivada", tono: "gris" }
};

export const ESTADOS_GENERACION = {
  pendiente: { texto: "En cola", tono: "azul" },
  procesando: { texto: "Generando", tono: "azul" },
  completada: { texto: "Lista para revisar", tono: "verde" },
  fallida: { texto: "No se pudo generar", tono: "rojo" },
  interrumpida: { texto: "Cancelada", tono: "gris" }
};

// Por qué terminó mal una generación (errorCodigo del servidor), en palabras para el docente
export const MENSAJES_ERROR_GENERACION = {
  GENERACION_DESHABILITADA: "La creación con IA todavía no está habilitada.",
  GENERACION_EN_CURSO: "Ya tenías otra actividad generándose.",
  CUPO_DIARIO_AGOTADO: "Ya usaste todas las actividades con IA de hoy.",
  PRESUPUESTO_AGOTADO: "La creación con IA no estaba disponible en ese momento.",
  CONTENIDO_INVALIDO: "La IA propuso algo que no cumple las reglas de la actividad. Prueba de nuevo, quizá pidiendo algo un poco distinto.",
  GENERADOR_TIEMPO_AGOTADO: "La IA tardó demasiado en responder. Prueba de nuevo en unos minutos.",
  GENERADOR_ERROR: "No se pudo conectar con la IA. Prueba de nuevo en unos minutos.",
  GENERADOR_BLOQUEADO: "La IA no pudo atender esa petición. Prueba con una instrucción distinta.",
  GENERADOR_RESPUESTA_VACIA: "La IA no devolvió una actividad. Prueba de nuevo.",
  GENERADOR_RESPUESTA_INCOMPLETA: "La IA no alcanzó a terminar la actividad. Prueba de nuevo.",
  GENERADOR_RESPUESTA_INVALIDA: "La IA respondió algo que no se pudo usar. Prueba de nuevo.",
  ERROR_AL_GUARDAR: "La actividad se generó pero no se pudo guardar. Prueba de nuevo.",
  CANCELADA_POR_DOCENTE: "La cancelaste."
};

export const AVATARES = ["gato", "ave", "tortuga", "pez", "conejo", "ardilla"];

export const opcionesDe = (objeto) => Object.entries(objeto).map(([valor, info]) => ({
  valor,
  texto: typeof info === "string" ? info : info.texto
}));

// Año lectivo sugerido: el de la sierra ecuatoriana empieza en septiembre
export const anioLectivoActual = () => {
  const hoy = new Date();
  const inicio = hoy.getMonth() >= 7 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return `${inicio}-${inicio + 1}`;
};

export const nombreCurso = (curso) => (curso ? `${curso.grado} ${curso.paralelo}` : "");
export const nombreEstudiante = (e) => (e ? (e.apodo ? `${e.apodo} · ${e.codigoLista}` : `Estudiante ${e.codigoLista}`) : "");

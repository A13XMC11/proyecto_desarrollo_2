// Espejo de server-v2/src/lib/Compartido/Dominio/ValoresPermitidos.js con los textos para la interfaz.
// El servidor sigue siendo quien valida: esto solo arma formularios y etiquetas.

export const GRADOS = ["1.º EGB", "2.º EGB", "3.º EGB"];
export const FRANJAS_EDAD = [5, 6, 7];
export const CANTIDADES_EJERCICIOS = [5, 10];

export const HABILIDADES = {
  vocales: { texto: "Vocales", mecanica: "seleccionar_opcion", mecanicaTexto: "Elegir la respuesta" },
  palabras_silabas: { texto: "Palabras con sílabas", mecanica: "ordenar_silabas", mecanicaTexto: "Ordenar sílabas" },
  completar_silaba: { texto: "Completar la sílaba", mecanica: "seleccionar_opcion", mecanicaTexto: "Elegir la sílaba que falta" },
  contar_silabas: { texto: "Contar sílabas", mecanica: "seleccionar_opcion", mecanicaTexto: "Elegir cuántas sílabas tiene" }
};

export const TEMATICAS = {
  animales: "Animales",
  objetos_cotidianos: "Objetos de casa",
  naturaleza: "Naturaleza",
  cuerpo: "Cuerpo humano",
  escuela: "Escuela"
};

// Del catálogo revisado (las temáticas de arriba) o libre (un texto corto que escribe el docente)
export const MODOS_TEMATICA = {
  catalogo: "Temática del catálogo",
  libre: "Otra temática"
};

// Nombres de las categorías de iconos (el servidor las entrega por clave)
export const CATEGORIAS_ICONOS = {
  animales: "Animales", frutas: "Frutas", verduras: "Verduras", objetos: "Objetos", naturaleza: "Naturaleza",
  cuerpo: "Cuerpo", escuela: "Escuela", comida: "Comida", transporte: "Transporte", juguetes: "Juguetes"
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
  interrumpida: { texto: "Interrumpida", tono: "gris" }
};

// Explicación para el docente según el código que guarda el servidor
export const MOTIVOS_GENERACION = {
  CANCELADA_POR_DOCENTE: "La cancelaste.",
  CONTENIDO_INVALIDO: "La IA propuso palabras o textos que no pasaron la revisión automática para niños. Este intento cuenta como una de las generaciones del día. Prueba con otra temática.",
  GENERADOR_CANDIDATAS_INSUFICIENTES: "No se encontraron suficientes palabras válidas para esa temática. Prueba con otra temática o con palabras más comunes. Este intento cuenta como una de las generaciones del día.",
  PROVEEDOR_ERROR: "El servicio de IA no respondió bien. Inténtalo de nuevo en unos minutos.",
  CATALOGO_INSUFICIENTE: "No hay suficientes palabras revisadas para esa temática.",
  GENERACION_DESHABILITADA: "La creación con IA todavía no está habilitada. Puedes crear la actividad a mano.",
  GENERACION_LIBRE_DESHABILITADA: "La opción «Otra temática» todavía no está habilitada. Elige una temática del catálogo.",
  TEMATICA_NO_PERMITIDA: "Esa temática no es adecuada para esta actividad. Prueba con otra, por ejemplo frutas, colores o medios de transporte.",
  INSTRUCCION_NO_PERMITIDA: "Tu instrucción para la IA contiene algo que no es adecuado para actividades con niños. Escríbela de otra forma o bórrala.",
  CLAVE_REUTILIZADA: "Esta solicitud ya se había enviado con otros datos. Vuelve a pedirla desde cero.",
  GENERACION_EN_CURSO: "Ya tienes otra actividad generándose. Espera a que termine.",
  CUPO_DIARIO_AGOTADO: "Ya usaste todas las actividades con IA de hoy. Mañana tendrás más.",
  PRESUPUESTO_AGOTADO: "La creación con IA no estaba disponible en ese momento.",
  GENERADOR_TIEMPO_AGOTADO: "La IA tardó demasiado en responder. Prueba de nuevo en unos minutos.",
  GENERADOR_ERROR: "No se pudo conectar con la IA. Prueba de nuevo en unos minutos.",
  GENERADOR_BLOQUEADO: "La IA no pudo atender esa petición. Prueba con una instrucción distinta.",
  GENERADOR_RESPUESTA_VACIA: "La IA no devolvió una actividad. Prueba de nuevo.",
  GENERADOR_RESPUESTA_INCOMPLETA: "La IA no alcanzó a terminar la actividad. Prueba de nuevo.",
  GENERADOR_RESPUESTA_INVALIDA: "La IA respondió algo que no se pudo usar. Prueba de nuevo.",
  ERROR_AL_GUARDAR: "La actividad se generó pero no se pudo guardar. Prueba de nuevo.",
  interrumpida: "Se cortó mientras se generaba. Puedes pedirla de nuevo."
};

// Rechazos del servidor al guardar o aprobar una actividad de temática libre. Fijos: nunca repiten lo escrito.
export const MENSAJES_CONTENIDO = {
  PALABRA_NO_PERMITIDA: "Una palabra de la actividad no es adecuada para niños, así que no se puede guardar.",
  TEXTO_NO_PERMITIDO: "La consigna o la pista usa una palabra que no es adecuada para niños. Escríbela de otra forma.",
  ICONO_NO_PERMITIDO: "Ese icono no está en la lista permitida. Elige otro de la lista.",
  RESPUESTA_REVELADA: "La consigna o la pista dice la respuesta. Escríbela sin revelarla.",
  CONSIGNA_INVALIDA: "La consigna o la pista no tiene palabras. Escribe un texto."
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

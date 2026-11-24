// Mensajes para el docente según el código que devuelve el servidor al pedir la recomendación con IA.
// Siempre son textos fijos: nunca repiten lo que diga el servidor.
const POR_CODIGO = {
  RECOMENDACION_DESHABILITADA: "La recomendación con IA no está disponible por ahora. Las cifras de arriba siguen siendo válidas.",
  DATOS_INSUFICIENTES: "Todavía hay pocas respuestas para recomendar algo. Juega más actividades y vuelve a intentarlo.",
  RECOMENDACIONES_AGOTADAS: "Ya usaste todas las recomendaciones con IA de este mes. Se renuevan el mes que viene.",
  PRESUPUESTO_AGOTADO: "La recomendación con IA no está disponible por ahora. Inténtalo más tarde.",
  GENERADOR_ERROR: "No se pudo redactar la recomendación. Puedes volver a intentarlo.",
  GENERADOR_TIEMPO_AGOTADO: "La IA tardó demasiado en responder. Puedes volver a intentarlo.",
  GENERADOR_RESPUESTA_INVALIDA: "La IA no entregó una recomendación utilizable. Puedes volver a intentarlo.",
  GENERADOR_RESPUESTA_INCOMPLETA: "La IA no terminó la recomendación. Puedes volver a intentarlo.",
  GENERADOR_RESPUESTA_VACIA: "La IA no entregó una recomendación. Puedes volver a intentarlo.",
  GENERADOR_BLOQUEADO: "La IA no pudo redactar esta recomendación. Revisa las cifras de arriba."
};

export const mensajeDeRecomendacion = (error) => {
  if (error && error.estado === 0 && error.message) return error.message;
  return POR_CODIGO[error?.codigo] || "No se pudo redactar la recomendación. Puedes volver a intentarlo.";
};

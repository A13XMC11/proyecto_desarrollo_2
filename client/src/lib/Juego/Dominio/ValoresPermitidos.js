// Espejo de server-v2/src/lib/Compartido/Dominio/ValoresPermitidos.js con los textos para la interfaz.
// El servidor sigue siendo quien valida: esto solo arma formularios y etiquetas.

export const GRADOS = ["1.º EGB", "2.º EGB", "3.º EGB"];
export const FRANJAS_EDAD = [5, 6, 7];
export const CANTIDADES_EJERCICIOS = [5, 10];

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

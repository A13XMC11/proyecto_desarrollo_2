// Fuente única de los valores permitidos. Las entidades de Dominio y los modelos
// los leen desde aquí (Dominio no puede importar Infraestructura).

const GRADOS = ["1.º EGB", "2.º EGB", "3.º EGB"];
const FRANJAS_EDAD = [5, 6, 7];

const HABILIDADES = ["vocales", "palabras_silabas"];
const MECANICAS = ["seleccionar_opcion", "ordenar_silabas"];
const TEMATICAS = ["animales", "objetos_cotidianos", "naturaleza"];
const CANTIDADES_EJERCICIOS = [5, 10];

// Compatibilidad habilidad -> mecánica
const COMPATIBILIDAD = {
  vocales: "seleccionar_opcion",
  palabras_silabas: "ordenar_silabas"
};

const ORIGENES_JUEGO = ["ia", "manual"];
const ESTADOS_JUEGO = ["borrador", "listo", "archivado"];
const ESTADOS_VERSION = ["borrador", "aprobada", "descartada"];
const ESTADOS_SESION = ["en_curso", "finalizada", "abandonada"];
const ESTADOS_GENERACION = ["pendiente", "procesando", "completada", "fallida", "interrumpida"];
const ESTADOS_GENERACION_ACTIVOS = ["pendiente", "procesando"];
const NUMEROS_INTENTO = [1, 2];

const SUPERFICIES = ["docente", "aula"];
const DISPOSITIVOS = ["computador", "tableta"];
const CANALES = SUPERFICIES.flatMap((superficie) =>
  DISPOSITIVOS.map((dispositivo) => ({
    codigo: `${superficie}_${dispositivo}`,
    superficie,
    dispositivo
  }))
);
const CODIGOS_CANAL = CANALES.map((c) => c.codigo);

const TIPOS_INTERACCION = [
  "inicio_partida",
  "intento",
  "pista",
  "reanudacion",
  "fin_partida",
  "consulta_resultados"
];

module.exports = {
  GRADOS,
  FRANJAS_EDAD,
  HABILIDADES,
  MECANICAS,
  TEMATICAS,
  CANTIDADES_EJERCICIOS,
  COMPATIBILIDAD,
  ORIGENES_JUEGO,
  ESTADOS_JUEGO,
  ESTADOS_VERSION,
  ESTADOS_SESION,
  ESTADOS_GENERACION,
  ESTADOS_GENERACION_ACTIVOS,
  NUMEROS_INTENTO,
  SUPERFICIES,
  DISPOSITIVOS,
  CANALES,
  CODIGOS_CANAL,
  TIPOS_INTERACCION
};

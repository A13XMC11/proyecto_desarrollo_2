const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const ErrorDelGenerador = require("../../Compartido/Dominio/Errores/ErrorDelGenerador");
const VersionJuego = require("../../Juego/Dominio/Entidades/VersionJuego");
const { evaluarPalabra, clavePalabra } = require("../../Juego/Dominio/Entidades/ValidacionContenidoLibre");
const { completarSilaba, contarSilabas } = require("./ejerciciosDeSilabas");
const { MAX_CANDIDATAS } = require("./construirPromptGeneracion");

// Temática libre: de las candidatas que propone la IA al conjunto de ejercicios.
// La IA propone solo { palabra, icono?, consigna, pista? }. Aquí el servidor calcula sílabas (Silabeador), opciones,
// distractores, respuesta correcta e ids, y descarta toda candidata que no supere la validación del Dominio:
// la MISMA que se aplicará al aprobar, para que nada que se entregue vaya a rechazarse después.

const VOCALES = ["a", "e", "i", "o", "u"];
const CAMPOS_CANDIDATA = ["palabra", "icono", "consigna", "pista"];

// Por qué se descartó una candidata, en palabras para el docente. Nunca incluye la palabra ni el término bloqueado.
const MOTIVOS = {
  PALABRA_INVALIDA: "letras no permitidas",
  PALABRA_NO_PERMITIDA: "contenido no permitido para niños",
  TEXTO_NO_PERMITIDO: "contenido no permitido para niños",
  TEMATICA_NO_PERMITIDA: "contenido no permitido para niños",
  SILABEO_DUDOSO: "sílabas dudosas",
  SILABAS_FUERA_DE_RANGO: "sílabas fuera de rango",
  PALABRA_NO_EMPIEZA_CON_VOCAL: "no empieza con vocal",
  PALABRA_REPETIDA: "palabra repetida",
  ICONO_NO_PERMITIDO: "icono fuera de la lista",
  RESPUESTA_REVELADA: "consigna o pista que revela la respuesta",
  CONSIGNA_INVALIDA: "consigna o pista sin palabras",
  CAMPOS_DESCONOCIDOS: "campos desconocidos"
};
const motivoDe = (error) => MOTIVOS[error.codigo] || "estructura inválida";

const rechazo = (mensaje, codigo) => new EntradaInvalida(mensaje, codigo);
const hay = (valor) => valor !== undefined && valor !== null && valor !== "";
const sinTildes = (texto) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// La forma de una candidata: solo los cuatro campos del esquema, y del tipo que corresponde
function revisarForma(candidata) {
  if (!candidata || typeof candidata !== "object" || Array.isArray(candidata)) throw rechazo("la candidata no es un objeto", "ESTRUCTURA_INVALIDA");
  if (Object.keys(candidata).some((campo) => !CAMPOS_CANDIDATA.includes(campo))) throw rechazo("campos desconocidos", "CAMPOS_DESCONOCIDOS");
  if (typeof candidata.consigna !== "string" || !candidata.consigna.trim()) throw rechazo("falta la consigna", "ESTRUCTURA_INVALIDA");
  for (const campo of ["pista", "icono"]) {
    if (hay(candidata[campo]) && typeof candidata[campo] !== "string") throw rechazo(`${campo} inválido`, "ESTRUCTURA_INVALIDA");
  }
}

// --- Armado de cada ejercicio: aquí se decide todo lo que la IA no decide ----------------------------------

function ejercicioVocales({ id, posicion, palabra, consigna, pista, icono }) {
  const inicial = sinTildes(palabra)[0];
  const otras = VOCALES.filter((v) => v !== inicial);
  // Las dos vocales falsas rotan con la posición para que no sean siempre las mismas
  const textos = [inicial, otras[posicion % otras.length], otras[(posicion + 1) % otras.length]].map((v) => v.toUpperCase()).sort();
  return {
    id, consigna, ...(pista ? { pista } : {}), objetivo: palabra, ...(icono ? { icono } : {}),
    opciones: textos.map((texto, i) => ({ id: `o${i + 1}`, texto })), respuestaCorrectaId: `o${textos.indexOf(inicial.toUpperCase()) + 1}`
  };
}

// contarSilabas y completarSilaba arman el ejercicio a partir de un "recurso"; aquí el recurso es la propia palabra
// (no hay catálogo), así que se descarta el recursoId que traen y no se usa
function sinRecursoId({ recursoId, ...resto }) {
  return resto;
}

function ejercicioContar({ id, palabra, silabas, consigna, pista, icono }) {
  return sinRecursoId(contarSilabas({ id, recurso: { id: palabra, palabra, silabas, icono }, consigna, pista }));
}

// El hueco lo elige el servidor (rota con la posición); la palabra completa va en palabraId, que el estudiante no ve
function ejercicioCompletar({ id, posicion, palabra, silabas, consigna, pista, icono, pool }) {
  const ejercicio = completarSilaba({
    id, recurso: { id: palabra, palabra, silabas, icono }, indice: posicion % silabas.length, consigna, pista, recursos: pool, semilla: posicion
  });
  return { ...sinRecursoId(ejercicio), palabraId: palabra };
}

function ejercicioOrdenar({ id, palabra, silabas, consigna, pista, icono }) {
  const piezas = silabas.map((texto, i) => ({ id: `p${i + 1}`, texto }));
  return {
    id, consigna, ...(pista ? { pista } : {}), palabraId: palabra, ...(icono ? { icono } : {}), piezas, ordenCorrecto: piezas.map((p) => p.id)
  };
}

const CONSTRUCTORES = {
  vocales: ejercicioVocales,
  contar_silabas: ejercicioContar,
  completar_silaba: ejercicioCompletar,
  palabras_silabas: ejercicioOrdenar
};

// --- Selección ---------------------------------------------------------------------------------------------

// Devuelve los primeros `cantidad` ejercicios válidos, en el orden en que llegaron las candidatas. Si no alcanzan,
// lanza GENERADOR_CANDIDATAS_INSUFICIENTES indicando cuántas pasaron y por qué se descartó el resto.
function seleccionarEjerciciosLibres({ habilidad, mecanica, tematica, cantidad, candidatas, filtroContenido, emojisPermitidos }) {
  const configuracion = { habilidad, mecanica, modoTematica: "libre", tematica, cantidadEjercicios: cantidad };
  new VersionJuego({ juegoId: "candidata", configuracion }); // una configuración inválida es un error de quien llama, no de la IA

  const consideradas = candidatas.slice(0, MAX_CANDIDATAS);
  const descartes = {};
  const descartar = (error) => {
    if (!(error instanceof EntradaInvalida)) throw error;
    const motivo = motivoDe(error);
    descartes[motivo] = (descartes[motivo] || 0) + 1;
  };

  // 1.ª pasada: forma de la candidata y su palabra (letras, filtro, sílabas, rango). Las que sirven, con sus sílabas.
  const buenas = [];
  consideradas.forEach((candidata, i) => {
    try {
      revisarForma(candidata);
      const { palabra, silabas } = evaluarPalabra(candidata.palabra, habilidad, filtroContenido, `candidata ${i + 1}`);
      buenas.push({ candidata, palabra, silabas });
    } catch (error) {
      descartar(error);
    }
  });

  // Los distractores de "completar" salen de las sílabas de las demás palabras buenas (ya pasaron el filtro)
  const pool = buenas.filter((b) => b.silabas).map((b) => ({ id: b.palabra, palabra: b.palabra, silabas: b.silabas }));

  // 2.ª pasada: armar el ejercicio y validarlo con el Dominio, hasta reunir `cantidad`
  const ejercicios = [];
  const usadas = new Set();
  for (const { candidata, palabra, silabas } of buenas) {
    if (ejercicios.length === cantidad) break;
    try {
      if (usadas.has(clavePalabra(palabra))) throw rechazo("palabra repetida", "PALABRA_REPETIDA");
      const icono = hay(candidata.icono) ? candidata.icono : undefined;
      if (icono && !emojisPermitidos.esPermitido(icono)) throw rechazo("icono fuera de la lista", "ICONO_NO_PERMITIDO");
      const ejercicio = CONSTRUCTORES[habilidad]({
        id: `e${ejercicios.length + 1}`, posicion: ejercicios.length, palabra, silabas, pool,
        consigna: candidata.consigna.trim(), pista: hay(candidata.pista) && candidata.pista.trim() ? candidata.pista.trim() : undefined, icono
      });
      new VersionJuego({ juegoId: "candidata", configuracion, ejercicios: [ejercicio] })
        .validarContenido(undefined, { permitirDiez: true, exigirCantidad: false, filtroContenido, emojisPermitidos });
      ejercicios.push(ejercicio);
      usadas.add(clavePalabra(palabra));
    } catch (error) {
      descartar(error);
    }
  }

  if (ejercicios.length < cantidad) {
    const detalle = Object.entries(descartes).map(([motivo, n]) => `${n} por ${motivo}`).join(", ");
    const error = new ErrorDelGenerador(
      `Solo ${ejercicios.length} de ${cantidad} ejercicios necesarios pasaron la validación (de ${consideradas.length} candidatas evaluadas)` +
        (detalle ? `. Descartadas: ${detalle}` : ""),
      "GENERADOR_CANDIDATAS_INSUFICIENTES"
    );
    error.descartes = descartes;
    throw error;
  }
  return ejercicios;
}

module.exports = { seleccionarEjerciciosLibres };

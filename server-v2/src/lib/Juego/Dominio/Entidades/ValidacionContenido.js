const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");

const CAMPOS_EJERCICIO = [
  "id", "consigna", "pista", "objetivo", "recursoId", "icono", "opciones", "respuestaCorrectaId",
  "palabraId", "piezas", "ordenCorrecto"
];
const CAMPOS_OPCION = ["id", "texto", "recursoId"];
const CAMPOS_PIEZA = ["id", "texto"];
const VOCALES = ["a", "e", "i", "o", "u"];

// Minúsculas y sin tildes, para comparar textos sin distinguir acentos
const normalizar = (texto) => String(texto).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Palabra completa: no cuenta si está pegada a otras letras o números ("poroso" no contiene "oso")
function contienePalabra(texto, palabra) {
  const patron = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(normalizar(palabra))}(?![\\p{L}\\p{N}])`, "u");
  return patron.test(normalizar(texto));
}

function rechazarCamposDesconocidos(ejercicios) {
  if (!Array.isArray(ejercicios)) throw new EntradaInvalida("ejercicios inválidos");
  const revisar = (objeto, permitidos, donde) => {
    if (!objeto || typeof objeto !== "object" || Array.isArray(objeto)) {
      throw new EntradaInvalida(`${donde} inválido`);
    }
    const extra = Object.keys(objeto).filter((k) => !permitidos.includes(k));
    if (extra.length) throw new EntradaInvalida(`campo desconocido en ${donde}: ${extra.join(", ")}`);
  };
  ejercicios.forEach((e, i) => {
    const donde = `ejercicio ${e && e.id !== undefined ? e.id : i + 1}`;
    revisar(e, CAMPOS_EJERCICIO, donde);
    (Array.isArray(e.opciones) ? e.opciones : []).forEach((o) => revisar(o, CAMPOS_OPCION, `${donde}, opción`));
    (Array.isArray(e.piezas) ? e.piezas : []).forEach((p) => revisar(p, CAMPOS_PIEZA, `${donde}, pieza`));
  });
}

function recursoValido(catalogo, id, tematica, donde) {
  const recurso = catalogo.obtenerRecurso(id);
  if (!recurso) throw new EntradaInvalida(`${donde}: el recurso ${id} no existe en el catálogo`);
  if (recurso.tematica !== tematica) {
    throw new EntradaInvalida(`${donde}: el recurso ${id} no pertenece a la temática ${tematica}`);
  }
  return recurso;
}

const MARCA_HUECO = "__";

// El icono, si viene, es el del recurso: un ejercicio no puede mostrar otro dibujo que el de su palabra
function comprobarIcono(ejercicio, recurso, donde) {
  if (ejercicio.icono && ejercicio.icono !== recurso.icono) {
    throw new EntradaInvalida(`${donde}: el icono no corresponde a la palabra ${recurso.palabra}`);
  }
}

function comprobarOpcionesDistintas(ejercicio, catalogo, tematica, donde) {
  const opcionesNorm = ejercicio.opciones.map((o) => normalizar(o.texto));
  if (new Set(opcionesNorm).size !== opcionesNorm.length) {
    throw new EntradaInvalida(`${donde}: opciones con texto duplicado`);
  }
  ejercicio.opciones.forEach((o) => {
    if (o.recursoId) recursoValido(catalogo, o.recursoId, tematica, donde);
  });
}

// Recurso del ejercicio de seleccionar opción: obligatorio, de la temática y con su icono
function recursoDelEjercicio(ejercicio, catalogo, tematica, donde) {
  if (!ejercicio.recursoId) throw new EntradaInvalida(`${donde}: recursoId requerido`);
  const recurso = recursoValido(catalogo, ejercicio.recursoId, tematica, donde);
  comprobarIcono(ejercicio, recurso, donde);
  return recurso;
}

// El modo aula muestra el objetivo en grande: debe ser la palabra, no la vocal ni otro texto
function comprobarObjetivoEsPalabra(ejercicio, recurso, donde, { requerido = false } = {}) {
  if (!ejercicio.objetivo && !requerido) return;
  if (!ejercicio.objetivo || normalizar(ejercicio.objetivo) !== normalizar(recurso.palabra)) {
    throw new EntradaInvalida(`${donde}: el objetivo debe ser la palabra ${recurso.palabra}`);
  }
}

// Vocales: la respuesta es la vocal inicial de la palabra
function validarSeleccion(ejercicio, catalogo, tematica, donde) {
  comprobarOpcionesDistintas(ejercicio, catalogo, tematica, donde);
  const recurso = recursoDelEjercicio(ejercicio, catalogo, tematica, donde);
  const vocal = recurso.vocalInicial && normalizar(recurso.vocalInicial);
  if (!VOCALES.includes(vocal)) throw new EntradaInvalida(`${donde}: el recurso no tiene vocal inicial`);
  const correcta = ejercicio.opciones.find((o) => o.id === ejercicio.respuestaCorrectaId);
  if (normalizar(correcta.texto) !== vocal) {
    throw new EntradaInvalida(`${donde}: la respuesta correcta no es la vocal inicial de la palabra`);
  }
  comprobarObjetivoEsPalabra(ejercicio, recurso, donde);
  return { respuesta: vocal, reveladores: [recurso.palabra, `vocal ${vocal}`] };
}

// Completar sílaba: el objetivo muestra las sílabas con un hueco («a __ ja») y la respuesta es la sílaba aprobada de ese hueco
function validarCompletarSilaba(ejercicio, catalogo, tematica, donde) {
  comprobarOpcionesDistintas(ejercicio, catalogo, tematica, donde);
  const recurso = recursoDelEjercicio(ejercicio, catalogo, tematica, donde);
  const partes = String(ejercicio.objetivo || "").trim().split(/\s+/);
  if (partes.filter((p) => p === MARCA_HUECO).length !== 1) {
    throw new EntradaInvalida(`${donde}: el objetivo debe tener un solo hueco (${MARCA_HUECO})`);
  }
  const aprobadas = recurso.silabas.map(normalizar);
  const hueco = partes.indexOf(MARCA_HUECO);
  const visibles = partes.map((p, i) => (i === hueco ? aprobadas[i] : normalizar(p)));
  if (partes.length !== aprobadas.length || visibles.some((p, i) => p !== aprobadas[i])) {
    throw new EntradaInvalida(`${donde}: el objetivo no tiene las sílabas de la palabra ${recurso.palabra}`);
  }
  const correcta = ejercicio.opciones.find((o) => o.id === ejercicio.respuestaCorrectaId);
  if (normalizar(correcta.texto) !== aprobadas[hueco]) {
    throw new EntradaInvalida(`${donde}: la respuesta correcta no es la sílaba que falta`);
  }
  return { respuesta: `${recurso.id}:${aprobadas[hueco]}`, reveladores: [recurso.palabra] };
}

// Contar sílabas: las opciones son números y la respuesta es la cantidad de sílabas aprobada
function validarContarSilabas(ejercicio, catalogo, tematica, donde) {
  comprobarOpcionesDistintas(ejercicio, catalogo, tematica, donde);
  const recurso = recursoDelEjercicio(ejercicio, catalogo, tematica, donde);
  if (!ejercicio.opciones.every((o) => /^[1-9]$/.test(o.texto))) {
    throw new EntradaInvalida(`${donde}: las opciones deben ser un número del 1 al 9`);
  }
  comprobarObjetivoEsPalabra(ejercicio, recurso, donde, { requerido: true });
  const correcta = ejercicio.opciones.find((o) => o.id === ejercicio.respuestaCorrectaId);
  if (correcta.texto !== String(recurso.silabas.length)) {
    throw new EntradaInvalida(`${donde}: la respuesta correcta no es el número de sílabas de la palabra`);
  }
  return { respuesta: recurso.id, reveladores: [recurso.palabra] };
}

// Ordenar sílabas: las piezas, en el orden correcto, deben ser la división silábica aprobada
function validarSilabas(ejercicio, catalogo, tematica, donde) {
  const recurso = recursoValido(catalogo, ejercicio.palabraId, tematica, donde);
  comprobarIcono(ejercicio, recurso, donde);
  const porId = new Map(ejercicio.piezas.map((p) => [p.id, p.texto]));
  const armada = ejercicio.ordenCorrecto.map((id) => normalizar(porId.get(id)));
  const aprobada = recurso.silabas.map(normalizar);
  if (armada.length !== aprobada.length || armada.some((s, i) => s !== aprobada[i])) {
    throw new EntradaInvalida(`${donde}: las sílabas no reconstruyen la palabra ${recurso.palabra}`);
  }
  return { respuesta: ejercicio.palabraId, reveladores: [recurso.palabra] };
}

// Cada habilidad sabe cómo comprobar su respuesta; la mecánica solo dice cómo se juega
const VALIDADORES = {
  vocales: validarSeleccion,
  completar_silaba: validarCompletarSilaba,
  contar_silabas: validarContarSilabas,
  palabras_silabas: validarSilabas
};

// exigirCantidad: false valida solo los ejercicios presentes (un borrador puede estar incompleto);
// la aprobación siempre lo exige.
function validarContenido(version, catalogo, { permitirDiez = false, exigirCantidad = true } = {}) {
  if (!catalogo || typeof catalogo.obtenerRecurso !== "function") {
    throw new EntradaInvalida("catálogo de recursos requerido");
  }
  const { habilidad, tematica, cantidadEjercicios, mecanica } = version.configuracion;
  const validar = VALIDADORES[habilidad];
  if (!validar) throw new EntradaInvalida(`habilidad sin reglas de validación: ${habilidad}`);
  if (cantidadEjercicios === 10 && !permitirDiez) {
    throw new EntradaInvalida("la cantidad de 10 ejercicios no está habilitada");
  }
  if (exigirCantidad && version.ejercicios.length !== cantidadEjercicios) {
    throw new EntradaInvalida(
      `se esperaban ${cantidadEjercicios} ejercicios y hay ${version.ejercicios.length}`
    );
  }
  const vistos = new Set();
  for (const ejercicio of version.ejercicios) {
    const donde = `ejercicio ${ejercicio.id}`;
    if (ejercicio.recursoId && mecanica === "ordenar_silabas") {
      recursoValido(catalogo, ejercicio.recursoId, tematica, donde);
    }
    const { respuesta, reveladores } = validar(ejercicio, catalogo, tematica, donde);

    const clave = `${normalizar(ejercicio.consigna)}|${respuesta}`;
    if (vistos.has(clave)) throw new EntradaInvalida(`${donde}: consigna y respuesta repetidas`);
    vistos.add(clave);

    for (const campo of ["consigna", "pista"]) {
      if (ejercicio[campo] && reveladores.some((r) => contienePalabra(ejercicio[campo], r))) {
        throw new EntradaInvalida(`${donde}: la ${campo} contiene la respuesta`);
      }
    }
  }
  return version;
}

module.exports = { validarContenido, rechazarCamposDesconocidos };

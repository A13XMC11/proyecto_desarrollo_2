const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");

const CAMPOS_EJERCICIO = [
  "id", "consigna", "pista", "objetivo", "recursoId", "opciones", "respuestaCorrectaId",
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

// Seleccionar opción: devuelve { respuesta, secretos } para las comprobaciones comunes
function validarSeleccion(ejercicio, catalogo, tematica, donde) {
  const opcionesNorm = ejercicio.opciones.map((o) => normalizar(o.texto));
  if (new Set(opcionesNorm).size !== opcionesNorm.length) {
    throw new EntradaInvalida(`${donde}: opciones con texto duplicado`);
  }
  ejercicio.opciones.forEach((o) => {
    if (o.recursoId) recursoValido(catalogo, o.recursoId, tematica, donde);
  });
  if (!ejercicio.recursoId) throw new EntradaInvalida(`${donde}: recursoId requerido`);
  const recurso = recursoValido(catalogo, ejercicio.recursoId, tematica, donde);
  const vocal = recurso.vocalInicial && normalizar(recurso.vocalInicial);
  if (!VOCALES.includes(vocal)) throw new EntradaInvalida(`${donde}: el recurso no tiene vocal inicial`);
  const correcta = ejercicio.opciones.find((o) => o.id === ejercicio.respuestaCorrectaId);
  if (normalizar(correcta.texto) !== vocal) {
    throw new EntradaInvalida(`${donde}: la respuesta correcta no es la vocal inicial de la palabra`);
  }
  // El modo aula muestra el objetivo en grande: debe ser la palabra, no la vocal ni otro texto
  if (ejercicio.objetivo && normalizar(ejercicio.objetivo) !== normalizar(recurso.palabra)) {
    throw new EntradaInvalida(`${donde}: el objetivo debe ser la palabra ${recurso.palabra}`);
  }
  return { respuesta: vocal, reveladores: [recurso.palabra, `vocal ${vocal}`] };
}

// Ordenar sílabas: las piezas, en el orden correcto, deben ser la división silábica aprobada
function validarSilabas(ejercicio, catalogo, tematica, donde) {
  const recurso = recursoValido(catalogo, ejercicio.palabraId, tematica, donde);
  const porId = new Map(ejercicio.piezas.map((p) => [p.id, p.texto]));
  const armada = ejercicio.ordenCorrecto.map((id) => normalizar(porId.get(id)));
  const aprobada = recurso.silabas.map(normalizar);
  if (armada.length !== aprobada.length || armada.some((s, i) => s !== aprobada[i])) {
    throw new EntradaInvalida(`${donde}: las sílabas no reconstruyen la palabra ${recurso.palabra}`);
  }
  return { respuesta: ejercicio.palabraId, reveladores: [recurso.palabra] };
}

// exigirCantidad: false valida solo los ejercicios presentes (un borrador puede estar incompleto);
// la aprobación siempre lo exige.
function validarContenido(version, catalogo, { permitirDiez = false, exigirCantidad = true } = {}) {
  if (!catalogo || typeof catalogo.obtenerRecurso !== "function") {
    throw new EntradaInvalida("catálogo de recursos requerido");
  }
  const { tematica, cantidadEjercicios, mecanica } = version.configuracion;
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
    const { respuesta, reveladores } = mecanica === "seleccionar_opcion"
      ? validarSeleccion(ejercicio, catalogo, tematica, donde)
      : validarSilabas(ejercicio, catalogo, tematica, donde);

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

const EntradaInvalida = require("./Errores/EntradaInvalida");

const ES_HTML = /[<>]/;
const ES_URL = /(https?:\/\/|www\.|ftp:\/\/)/i;
const ES_CORREO = /\S+@\S+/;

// Texto plano: sin HTML, URLs ni correos. Devuelve el texto recortado.
function textoPlano(valor, campo, { min = 0, max, requerido = false } = {}) {
  if (valor === undefined || valor === null || valor === "") {
    if (requerido) throw new EntradaInvalida(`${campo} requerido`);
    return undefined;
  }
  if (typeof valor !== "string") throw new EntradaInvalida(`${campo} debe ser texto`);
  const texto = valor.trim();
  if (requerido && texto.length === 0) throw new EntradaInvalida(`${campo} requerido`);
  if (texto.length < min) throw new EntradaInvalida(`${campo} debe tener al menos ${min} caracteres`);
  if (max !== undefined && texto.length > max) {
    throw new EntradaInvalida(`${campo} debe tener como máximo ${max} caracteres`);
  }
  if (ES_HTML.test(texto) || ES_URL.test(texto) || ES_CORREO.test(texto)) {
    throw new EntradaInvalida(`${campo} debe ser texto plano (sin HTML, URLs ni correos)`);
  }
  return texto;
}

// Icono de un recurso o ejercicio: uno o varios emojis, nunca texto. Es un carácter de texto, sin archivos ni permisos de uso.
const ES_ICONO = /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\uFE0F\u200D]*$/u;

function icono(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return undefined;
  if (typeof valor !== "string" || valor.length > 12 || !ES_ICONO.test(valor)) {
    throw new EntradaInvalida(`${campo} debe ser un emoji`);
  }
  return valor;
}

// Temática libre del docente: solo letras del español y espacios sueltos, de 3 a 40 caracteres.
// Ya normalizada (sin espacios de más ni mayúsculas) es lo que se guarda y se compara.
const ES_TEMATICA_LIBRE = /^[a-záéíóúüñ]+(?: [a-záéíóúüñ]+)*$/;
const MIN_TEMATICA_LIBRE = 3;
const MAX_TEMATICA_LIBRE = 40;

function esTematicaLibre(valor) {
  return typeof valor === "string" && valor.length >= MIN_TEMATICA_LIBRE && valor.length <= MAX_TEMATICA_LIBRE && ES_TEMATICA_LIBRE.test(valor);
}

// Normaliza (tilde compuesta, minúsculas, un solo espacio entre palabras) y valida. El mensaje nombra el campo y
// nunca repite lo recibido. Cualquier otro espacio en blanco (tabulador, salto de línea) se rechaza.
function tematicaLibre(valor, campo = "tematica") {
  if (typeof valor !== "string") throw new EntradaInvalida(`${campo} debe ser texto`);
  const texto = valor.normalize("NFC").toLowerCase().replace(/ {2,}/g, " ").replace(/^ | $/g, "");
  if (texto === "") throw new EntradaInvalida(`${campo} requerido`);
  if (!esTematicaLibre(texto)) {
    throw new EntradaInvalida(`${campo} debe tener solo letras y espacios, de ${MIN_TEMATICA_LIBRE} a ${MAX_TEMATICA_LIBRE} caracteres`);
  }
  return texto;
}

function enumerado(valor, permitidos, campo, { requerido = true } = {}) {
  if ((valor === undefined || valor === null) && !requerido) return undefined;
  if (!permitidos.includes(valor)) {
    throw new EntradaInvalida(`${campo} inválido: debe ser uno de ${permitidos.join(", ")}`);
  }
  return valor;
}

function identificador(valor, campo, { requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === "") {
    if (requerido) throw new EntradaInvalida(`${campo} requerido`);
    return undefined;
  }
  if (typeof valor !== "string" || valor.trim() === "") throw new EntradaInvalida(`${campo} inválido`);
  return valor;
}

function entero(valor, campo, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw new EntradaInvalida(`${campo} inválido`);
  }
  return valor;
}

function fechaOpcional(valor, campo) {
  if (valor === undefined || valor === null) return undefined;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new EntradaInvalida(`${campo} inválida`);
  return fecha;
}

// Fusiona los cambios pedidos sobre una entidad existente para volver a validarla con su constructor.
// Devuelve { datos, escritura }: `datos` para construir la entidad (null equivale a "sin valor") y
// `escritura` con solo los campos pedidos, conservando null para que el repositorio limpie el campo.
function fusionarCambios(actual, cambios, campos) {
  const datos = { ...actual };
  const escritura = {};
  for (const campo of campos) {
    if (!cambios || cambios[campo] === undefined) continue;
    escritura[campo] = cambios[campo];
    datos[campo] = cambios[campo] === null ? undefined : cambios[campo];
  }
  return { datos, escritura };
}

module.exports = { textoPlano, enumerado, icono, identificador, entero, fechaOpcional, fusionarCambios, tematicaLibre, esTematicaLibre };

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

module.exports = { textoPlano, enumerado, identificador, entero, fechaOpcional, fusionarCambios };

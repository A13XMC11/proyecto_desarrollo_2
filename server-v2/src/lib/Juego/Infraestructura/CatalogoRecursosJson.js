const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const { TEMATICAS } = require("../../Compartido/Dominio/ValoresPermitidos");
const { icono } = require("../../Compartido/Dominio/Validaciones");

const VOCALES = ["a", "e", "i", "o", "u"];
const MAX_LARGO_SILABA = 10;
const normalizar = (texto) => String(texto).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Un catálogo incoherente es un error de despliegue: se detecta al cargar, no cuando un docente lo usa
function validarRecurso(recurso, vistos) {
  const donde = `catálogo, recurso ${recurso && recurso.id}`;
  if (!recurso || typeof recurso.id !== "string" || !recurso.id.trim()) throw new EntradaInvalida("catálogo: recurso sin id");
  if (vistos.has(recurso.id)) throw new EntradaInvalida(`${donde}: id repetido`);
  if (typeof recurso.palabra !== "string" || !recurso.palabra.trim()) throw new EntradaInvalida(`${donde}: palabra requerida`);
  if (!TEMATICAS.includes(recurso.tematica)) throw new EntradaInvalida(`${donde}: temática no permitida`);

  const { silabas } = recurso;
  const silabasValidas = Array.isArray(silabas) && silabas.length >= 2 &&
    silabas.every((s) => typeof s === "string" && s.trim() && s.length <= MAX_LARGO_SILABA);
  if (!silabasValidas || normalizar(silabas.join("")) !== normalizar(recurso.palabra)) {
    throw new EntradaInvalida(`${donde}: las sílabas (al menos dos) deben formar la palabra`);
  }

  const primera = normalizar(recurso.palabra)[0];
  const esperada = VOCALES.includes(primera) ? primera : undefined;
  if (recurso.vocalInicial !== esperada) {
    throw new EntradaInvalida(`${donde}: la vocal inicial debe ser ${esperada ? `"${esperada}"` : "omitida (no empieza con vocal)"}`);
  }
  try {
    icono(recurso.icono, "icono");
  } catch (error) {
    throw new EntradaInvalida(`${donde}: ${error.message}`);
  }
  vistos.add(recurso.id);
}

const copia = (recurso) => ({ ...recurso, silabas: [...recurso.silabas] });

class CatalogoRecursosJson {
  constructor(datos = require("./catalogo/learning-resources.json")) {
    if (!datos || !Array.isArray(datos.recursos)) throw new EntradaInvalida("catálogo: falta la lista de recursos");
    const vistos = new Set();
    datos.recursos.forEach((r) => validarRecurso(r, vistos));
    this.recursos = datos.recursos.map(copia);
  }

  obtenerRecurso(id) {
    const recurso = this.recursos.find((r) => r.id === id);
    return recurso && copia(recurso);
  }

  listar({ tematica } = {}) {
    if (tematica !== undefined && !TEMATICAS.includes(tematica)) throw new EntradaInvalida("tematica inválida");
    return this.recursos.filter((r) => !tematica || r.tematica === tematica).map(copia);
  }
}

module.exports = CatalogoRecursosJson;

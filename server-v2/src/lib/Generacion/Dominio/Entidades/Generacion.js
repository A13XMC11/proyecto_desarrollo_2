const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const {
  HABILIDADES, MECANICAS, TEMATICAS, MODOS_TEMATICA, CANTIDADES_EJERCICIOS, ESTADOS_GENERACION, COMPATIBILIDAD
} = require("../../../Compartido/Dominio/ValoresPermitidos");
const {
  textoPlano, enumerado, identificador, fechaOpcional, tematicaLibre
} = require("../../../Compartido/Dominio/Validaciones");

// En modo catálogo la temática es del enum, igual que siempre. En modo libre es el texto del docente, normalizado.
// Una generación NUEVA (sin id) con temática libre debe pasar el filtro de contenido infantil (puerto IFiltroContenido).
// Una ya guardada (con id) solo se lee: si la lista de términos cambiara después, no puede dejar de poder leerse.
function validarTematica({ id, modoTematica, tematica, filtroContenido }) {
  if (modoTematica !== "libre") return enumerado(tematica, TEMATICAS, "tematica");
  const texto = tematicaLibre(tematica, "tematica");
  if (id) return texto;
  if (!filtroContenido || typeof filtroContenido.evaluar !== "function") {
    throw new EntradaInvalida("Hace falta el filtro de contenido para validar una temática libre", "FILTRO_CONTENIDO_REQUERIDO");
  }
  if (!filtroContenido.evaluar(texto).permitido) {
    // El mensaje no repite la temática ni dice qué término la bloqueó
    throw new EntradaInvalida("Esa temática no está permitida en actividades para niños. Prueba con otra.", "TEMATICA_NO_PERMITIDA");
  }
  return texto;
}

// La instrucción opcional también viaja a la IA: una solicitud NUEVA debe pasar el mismo filtro que la temática. Una ya
// guardada (con id) solo se lee. Sin filtro (modo catálogo en pruebas de la entidad) no hay qué comprobar; la temática
// libre, en cambio, lo exige siempre (validarTematica). El mensaje no repite el texto ni dice qué término lo bloqueó.
function validarInstruccion({ id, instruccion, filtroContenido }) {
  const texto = textoPlano(instruccion, "instruccion", { max: 500 });
  if (id || !texto || !filtroContenido || typeof filtroContenido.evaluar !== "function") return texto;
  if (!filtroContenido.evaluar(texto).permitido) {
    throw new EntradaInvalida("La instrucción contiene algo que no es adecuado para actividades con niños. Escríbela de otra forma.", "INSTRUCCION_NO_PERMITIDA");
  }
  return texto;
}

function noNegativo(valor, campo) {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) {
    throw new EntradaInvalida(`${campo} inválido`);
  }
  return valor;
}

class Generacion {
  constructor({
    id, docenteId, canalId, claveSolicitud, parametros, estado = "pendiente", proveedor, modelo,
    tokensEntrada, tokensSalida, usoDesconocido = false, reserva, errorCodigo, juegoId,
    creadaEn, finalizadaEn, actualizadoEn, filtroContenido
  }) {
    if (typeof claveSolicitud !== "string" || claveSolicitud.length < 16 || claveSolicitud.length > 64) {
      throw new EntradaInvalida("claveSolicitud debe tener de 16 a 64 caracteres");
    }
    if (!parametros) throw new EntradaInvalida("parametros requeridos");
    enumerado(parametros.habilidad, HABILIDADES, "habilidad");
    // La mecánica se deduce de la habilidad: no se guarda; si se informa debe ser la compatible
    if (parametros.mecanica !== undefined) {
      enumerado(parametros.mecanica, MECANICAS, "mecanica");
      if (COMPATIBILIDAD[parametros.habilidad] !== parametros.mecanica) {
        throw new EntradaInvalida("La mecánica no es compatible con la habilidad");
      }
    }
    if (typeof usoDesconocido !== "boolean") throw new EntradaInvalida("usoDesconocido inválido");
    // Sin modoTematica es del catálogo: así se leen las generaciones guardadas antes de existir el modo
    const modoTematica = parametros.modoTematica === undefined ? "catalogo" : enumerado(parametros.modoTematica, MODOS_TEMATICA, "modoTematica");

    this.id = identificador(id, "id", { requerido: false });
    this.docenteId = identificador(docenteId, "docenteId");
    this.canalId = identificador(canalId, "canalId");
    this.claveSolicitud = claveSolicitud;
    this.parametros = {
      cursoId: identificador(parametros.cursoId, "cursoId"),
      estudianteId: identificador(parametros.estudianteId, "estudianteId", { requerido: false }),
      habilidad: parametros.habilidad,
      modoTematica,
      tematica: validarTematica({ id, modoTematica, tematica: parametros.tematica, filtroContenido }),
      cantidad: enumerado(parametros.cantidad, CANTIDADES_EJERCICIOS, "cantidad"),
      instruccion: validarInstruccion({ id, instruccion: parametros.instruccion, filtroContenido })
    };
    this.estado = enumerado(estado, ESTADOS_GENERACION, "estado");
    this.proveedor = proveedor;
    this.modelo = modelo;
    this.tokensEntrada = noNegativo(tokensEntrada, "tokensEntrada");
    this.tokensSalida = noNegativo(tokensSalida, "tokensSalida");
    this.usoDesconocido = usoDesconocido;
    // Reserva hecha en dos contadores: el diario del docente y el global del mes
    this.reserva = reserva
      ? {
          cuotaDiariaId: identificador(reserva.cuotaDiariaId, "cuotaDiariaId"),
          cupoDiario: noNegativo(reserva.cupoDiario, "cupoDiario"),
          cuotaGlobalId: identificador(reserva.cuotaGlobalId, "cuotaGlobalId"),
          montoGlobal: noNegativo(reserva.montoGlobal, "montoGlobal"),
          liberada: Boolean(reserva.liberada)
        }
      : undefined;
    this.errorCodigo = errorCodigo;
    this.juegoId = identificador(juegoId, "juegoId", { requerido: false });
    this.creadaEn = creadaEn;
    this.finalizadaEn = fechaOpcional(finalizadaEn, "finalizadaEn");
    this.actualizadoEn = actualizadoEn;
  }

  get mecanica() {
    return COMPATIBILIDAD[this.parametros.habilidad];
  }

  estaActiva() {
    return this.estado === "pendiente" || this.estado === "procesando";
  }
}

module.exports = Generacion;

const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const {
  HABILIDADES, MECANICAS, TEMATICAS, CANTIDADES_EJERCICIOS, ESTADOS_GENERACION, COMPATIBILIDAD
} = require("../../../Compartido/Dominio/ValoresPermitidos");
const {
  textoPlano, enumerado, identificador, fechaOpcional
} = require("../../../Compartido/Dominio/Validaciones");

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
    creadaEn, finalizadaEn, actualizadoEn
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

    this.id = identificador(id, "id", { requerido: false });
    this.docenteId = identificador(docenteId, "docenteId");
    this.canalId = identificador(canalId, "canalId");
    this.claveSolicitud = claveSolicitud;
    this.parametros = {
      cursoId: identificador(parametros.cursoId, "cursoId"),
      estudianteId: identificador(parametros.estudianteId, "estudianteId", { requerido: false }),
      habilidad: parametros.habilidad,
      tematica: enumerado(parametros.tematica, TEMATICAS, "tematica"),
      cantidad: enumerado(parametros.cantidad, CANTIDADES_EJERCICIOS, "cantidad"),
      instruccion: textoPlano(parametros.instruccion, "instruccion", { max: 500 })
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

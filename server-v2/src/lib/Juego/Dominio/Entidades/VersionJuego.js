const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const Ejercicio = require("./Ejercicio");
const {
  HABILIDADES, MECANICAS, TEMATICAS, CANTIDADES_EJERCICIOS, ESTADOS_VERSION, COMPATIBILIDAD
} = require("../../../Compartido/Dominio/ValoresPermitidos");
const { enumerado, entero, identificador, fechaOpcional } = require("../../../Compartido/Dominio/Validaciones");

class VersionJuego {
  constructor({
    id, juegoId, numero, formatoVersion = 1, configuracion, ejercicios = [],
    estado = "borrador", aprobadoEn, creadoEn, actualizadoEn
  }) {
    if (!configuracion) throw new EntradaInvalida("configuracion requerida");
    const { habilidad, mecanica, tematica, cantidadEjercicios } = configuracion;
    enumerado(habilidad, HABILIDADES, "habilidad");
    enumerado(mecanica, MECANICAS, "mecanica");
    enumerado(tematica, TEMATICAS, "tematica");
    enumerado(cantidadEjercicios, CANTIDADES_EJERCICIOS, "cantidadEjercicios");
    if (COMPATIBILIDAD[habilidad] !== mecanica) {
      throw new EntradaInvalida("La mecánica no es compatible con la habilidad");
    }
    if (!Array.isArray(ejercicios) || ejercicios.some((e) => !e || typeof e !== "object")) {
      throw new EntradaInvalida("ejercicios inválidos");
    }

    const lista = ejercicios.map((e) => (e instanceof Ejercicio ? e : new Ejercicio(e)));
    if (new Set(lista.map((e) => e.id)).size !== lista.length) {
      throw new EntradaInvalida("ids de ejercicio repetidos");
    }
    if (lista.length > cantidadEjercicios) {
      throw new EntradaInvalida("hay más ejercicios que la cantidad configurada");
    }
    lista.forEach((e) => {
      if (e.tipo !== mecanica) throw new EntradaInvalida(`el ejercicio ${e.id} no corresponde a la mecánica`);
      if (mecanica === "seleccionar_opcion" && e.opciones.length !== 3) {
        throw new EntradaInvalida(`el ejercicio ${e.id} debe tener exactamente 3 opciones`);
      }
    });

    this.id = identificador(id, "id", { requerido: false });
    this.juegoId = identificador(juegoId, "juegoId");
    this.numero = numero === undefined ? undefined : entero(numero, "numero", { min: 1 });
    this.formatoVersion = entero(formatoVersion, "formatoVersion", { min: 1 });
    this.configuracion = { habilidad, mecanica, tematica, cantidadEjercicios };
    this.ejercicios = lista;
    this.estado = enumerado(estado, ESTADOS_VERSION, "estado");
    this.aprobadoEn = fechaOpcional(aprobadoEn, "aprobadoEn");
    if (this.estado === "aprobada" && !this.aprobadoEn) throw new EntradaInvalida("aprobadoEn requerido");
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;
  }
}

module.exports = VersionJuego;

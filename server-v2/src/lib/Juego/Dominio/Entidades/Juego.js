const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const {
  HABILIDADES, MECANICAS, ORIGENES_JUEGO, ESTADOS_JUEGO, COMPATIBILIDAD
} = require("../../../Compartido/Dominio/ValoresPermitidos");
const { textoPlano, enumerado, identificador } = require("../../../Compartido/Dominio/Validaciones");

class Juego {
  constructor({
    id, docenteId, cursoId, estudianteId, generacionId, titulo, habilidad, mecanica,
    origen, estado = "borrador", versionActualId = null, creadoEn, actualizadoEn
  }) {
    enumerado(habilidad, HABILIDADES, "habilidad");
    enumerado(mecanica, MECANICAS, "mecanica");
    if (COMPATIBILIDAD[habilidad] !== mecanica) {
      throw new EntradaInvalida("La mecánica no es compatible con la habilidad");
    }
    if (origen === "ia" && !generacionId) {
      // Un juego de origen IA nace de una generación
      throw new EntradaInvalida("Un juego de origen ia requiere generacionId");
    }

    this.id = identificador(id, "id", { requerido: false });
    this.docenteId = identificador(docenteId, "docenteId");
    this.cursoId = identificador(cursoId, "cursoId");
    this.estudianteId = identificador(estudianteId, "estudianteId", { requerido: false });
    this.generacionId = identificador(generacionId, "generacionId", { requerido: false });
    this.titulo = textoPlano(titulo, "titulo", { min: 3, max: 80, requerido: true });
    this.habilidad = habilidad;
    this.mecanica = mecanica;
    this.origen = enumerado(origen, ORIGENES_JUEGO, "origen");
    this.estado = enumerado(estado, ESTADOS_JUEGO, "estado");
    this.versionActualId = identificador(versionActualId, "versionActualId", { requerido: false }) || null;
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;
  }
}

module.exports = Juego;

const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { textoPlano, identificador } = require("../../../Compartido/Dominio/Validaciones");

function unicos(lista, campo) {
  if (new Set(lista).size !== lista.length) throw new EntradaInvalida(`${campo} con ids repetidos`);
}

class Ejercicio {
  constructor({
    id, consigna, pista, objetivo, recursoId, opciones, respuestaCorrectaId,
    palabraId, piezas, ordenCorrecto
  }) {
    this.id = identificador(id, "ejercicio.id");
    this.consigna = textoPlano(consigna, "consigna", { max: 140, requerido: true });
    this.pista = textoPlano(pista, "pista", { max: 100 });
    this.objetivo = textoPlano(objetivo, "objetivo", { max: 40 });
    this.recursoId = identificador(recursoId, "recursoId", { requerido: false });

    if (opciones !== undefined) {
      if (!Array.isArray(opciones)) throw new EntradaInvalida("opciones inválidas");
      this.opciones = opciones.map((o) => ({
        id: identificador(o && o.id, "opcion.id"),
        texto: textoPlano(o.texto, "opcion.texto", { max: 40 }),
        recursoId: identificador(o.recursoId, "opcion.recursoId", { requerido: false })
      }));
      unicos(this.opciones.map((o) => o.id), "opciones");
      this.respuestaCorrectaId = identificador(respuestaCorrectaId, "respuestaCorrectaId");
      if (!this.opciones.some((o) => o.id === this.respuestaCorrectaId)) {
        throw new EntradaInvalida("respuestaCorrectaId no corresponde a ninguna opción");
      }
    }

    if (piezas !== undefined) {
      if (!Array.isArray(piezas) || !Array.isArray(ordenCorrecto)) {
        throw new EntradaInvalida("piezas y ordenCorrecto son obligatorios juntos");
      }
      this.palabraId = identificador(palabraId, "palabraId");
      this.piezas = piezas.map((p) => ({
        id: identificador(p && p.id, "pieza.id"),
        texto: textoPlano(p.texto, "pieza.texto", { max: 10, requerido: true })
      }));
      unicos(this.piezas.map((p) => p.id), "piezas");
      const ids = this.piezas.map((p) => p.id).sort();
      if (ordenCorrecto.length !== ids.length || [...ordenCorrecto].sort().some((x, i) => x !== ids[i])) {
        throw new EntradaInvalida("ordenCorrecto debe ser una permutación de las piezas");
      }
      this.ordenCorrecto = [...ordenCorrecto];
    }
  }

  // Regla de evaluación: seleccionar_opcion compara el id de la opción; ordenar_silabas, el orden de las piezas
  esRespuestaCorrecta(eleccion) {
    if (this.tipo === "seleccionar_opcion") return typeof eleccion === "string" && eleccion === this.respuestaCorrectaId;
    if (this.tipo === "ordenar_silabas") {
      return Array.isArray(eleccion) && eleccion.length === this.ordenCorrecto.length && eleccion.every((id, i) => id === this.ordenCorrecto[i]);
    }
    return false;
  }

  get tipo() {
    if (this.opciones) return "seleccionar_opcion";
    if (this.piezas) return "ordenar_silabas";
    return undefined;
  }
}

module.exports = Ejercicio;

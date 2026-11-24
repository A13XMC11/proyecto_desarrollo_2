const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { textoPlano, identificador, icono: validarIcono } = require("../../../Compartido/Dominio/Validaciones");

function unicos(lista, campo) {
  if (new Set(lista).size !== lista.length) throw new EntradaInvalida(`${campo} con ids repetidos`);
}

class Ejercicio {
  constructor({
    id, consigna, pista, objetivo, recursoId, icono, opciones, respuestaCorrectaId,
    palabraId, piezas, ordenCorrecto
  }) {
    this.id = identificador(id, "ejercicio.id");
    this.consigna = textoPlano(consigna, "consigna", { max: 140, requerido: true });
    this.pista = textoPlano(pista, "pista", { max: 100 });
    this.objetivo = textoPlano(objetivo, "objetivo", { max: 40 });
    this.recursoId = identificador(recursoId, "recursoId", { requerido: false });
    // Emoji de la palabra, para los niños que aún no leen con soltura; debe ser el del recurso (lo comprueba la validación pedagógica)
    this.icono = validarIcono(icono, "icono");

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

    // En una temática libre, "completar la sílaba" declara en palabraId la palabra completa (el estudiante no la ve):
    // de ella el servidor calcula la sílaba que falta. En el catálogo no se usa y no se guarda.
    if (piezas === undefined && palabraId !== undefined && palabraId !== null && palabraId !== "") {
      this.palabraId = identificador(palabraId, "palabraId");
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
      if (!Array.isArray(eleccion) || eleccion.length !== this.ordenCorrecto.length) return false;
      // Debe usar cada pieza exactamente una vez (no vale repetir una para igualar el texto)
      if (new Set(eleccion).size !== eleccion.length) return false;
      const textoDe = new Map(this.piezas.map((p) => [p.id, p.texto]));
      if (!eleccion.every((id) => textoDe.has(id))) return false;
      // Se compara lo que dice cada pieza: en pa-pa-ya las dos «pa» son intercambiables
      return eleccion.every((id, i) => textoDe.get(id) === textoDe.get(this.ordenCorrecto[i]));
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

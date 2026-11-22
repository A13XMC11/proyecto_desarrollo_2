const ErrorDelGenerador = require("../../Compartido/Dominio/Errores/ErrorDelGenerador");
const { completarSilaba, contarSilabas, conIcono } = require("./ejerciciosDeSilabas");

const VOCALES = ["a", "e", "i", "o", "u"];
const TEMAS = {
  animales: "los animales", objetos_cotidianos: "los objetos de casa", naturaleza: "la naturaleza",
  cuerpo: "el cuerpo", escuela: "la escuela"
};
const TITULOS = {
  vocales: "Vocales", palabras_silabas: "Sílabas", completar_silaba: "La sílaba que falta", contar_silabas: "Cuenta las sílabas"
};
const CONSIGNA_COMPLETAR = "¿Qué sílaba falta en la palabra?";
const CONSIGNA_CONTAR = "¿Cuántas sílabas tiene la palabra?";
const CONSIGNA_VOCALES = "¿Con qué vocal empieza esta palabra?";
const CONSIGNA_SILABAS = "Ordena las sílabas para formar la palabra";

// Generador sin IA: arma la actividad con fixtures a partir de los recursos del catálogo. Permite probar
// todo el flujo (cupo, validación, borrador, revisión) sin llamar a ningún proveedor ni gastar nada.
// Es determinista: la misma solicitud produce siempre la misma actividad.
class GeneradorContenidoFalso {
  async generar({ habilidad, tematica, cantidad, recursos }, { signal } = {}) {
    if (signal && signal.aborted) throw new ErrorDelGenerador("Generación cancelada", "GENERADOR_TIEMPO_AGOTADO");
    const ejercicios = this.ejerciciosDe(habilidad, recursos, cantidad);
    const titulo = `${TITULOS[habilidad] || "Actividad"}: ${TEMAS[tematica] || tematica}`;
    return { titulo, ejercicios, uso: { proveedor: "falso", modelo: "fixtures", tokensEntrada: 0, tokensSalida: 0 } };
  }

  ejerciciosDe(habilidad, recursos, cantidad) {
    if (habilidad === "vocales") return this.vocales(recursos, cantidad);
    if (habilidad === "completar_silaba") return this.completar(recursos, cantidad);
    if (habilidad === "contar_silabas") return this.contar(recursos, cantidad);
    return this.silabas(recursos, cantidad);
  }

  // Una palabra distinta por ejercicio mientras alcancen; el hueco recorre las posiciones de la palabra
  completar(recursos, cantidad) {
    if (!recursos.length) throw new ErrorDelGenerador("El catálogo no tiene palabras", "GENERADOR_ERROR");
    return Array.from({ length: cantidad }, (_, i) => {
      const recurso = recursos[i % recursos.length];
      return completarSilaba({
        id: `e${i + 1}`, recurso, indice: i % recurso.silabas.length, recursos, semilla: i,
        consigna: i < recursos.length ? CONSIGNA_COMPLETAR : `${CONSIGNA_COMPLETAR} (${i + 1})`,
        pista: "Lee en voz alta las sílabas que ya están"
      });
    });
  }

  contar(recursos, cantidad) {
    if (!recursos.length) throw new ErrorDelGenerador("El catálogo no tiene palabras", "GENERADOR_ERROR");
    return Array.from({ length: cantidad }, (_, i) => contarSilabas({
      id: `e${i + 1}`, recurso: recursos[i % recursos.length],
      consigna: i < recursos.length ? CONSIGNA_CONTAR : `${CONSIGNA_CONTAR} (${i + 1})`,
      pista: "Aplaude una vez por cada sílaba"
    }));
  }

  // Cada ejercicio usa una palabra con una vocal distinta; si se piden más, se repite con otra consigna
  vocales(recursos, cantidad) {
    const candidatos = VOCALES.flatMap((v) => recursos.filter((r) => r.vocalInicial === v).slice(0, 1));
    if (!candidatos.length) throw new ErrorDelGenerador("El catálogo no tiene palabras con vocal inicial", "GENERADOR_ERROR");
    return Array.from({ length: cantidad }, (_, i) => {
      const recurso = candidatos[i % candidatos.length];
      const posicion = VOCALES.indexOf(recurso.vocalInicial);
      const textos = [recurso.vocalInicial, VOCALES[(posicion + 1) % 5], VOCALES[(posicion + 2) % 5]].sort();
      return {
        id: `e${i + 1}`,
        consigna: i < candidatos.length ? CONSIGNA_VOCALES : `${CONSIGNA_VOCALES} (${i + 1})`,
        pista: "Escucha con atención el primer sonido",
        objetivo: recurso.palabra,
        recursoId: recurso.id,
        ...conIcono(recurso),
        opciones: textos.map((t, j) => ({ id: `o${j + 1}`, texto: t.toUpperCase() })),
        respuestaCorrectaId: `o${textos.indexOf(recurso.vocalInicial) + 1}`
      };
    });
  }

  silabas(recursos, cantidad) {
    if (!recursos.length) throw new ErrorDelGenerador("El catálogo no tiene palabras", "GENERADOR_ERROR");
    return Array.from({ length: cantidad }, (_, i) => {
      const recurso = recursos[i % recursos.length];
      const piezas = recurso.silabas.map((texto, j) => ({ id: `p${j + 1}`, texto }));
      return {
        id: `e${i + 1}`,
        consigna: i < recursos.length ? CONSIGNA_SILABAS : `${CONSIGNA_SILABAS} (${i + 1})`,
        objetivo: recurso.palabra,
        palabraId: recurso.id,
        ...conIcono(recurso),
        piezas,
        ordenCorrecto: piezas.map((p) => p.id)
      };
    });
  }
}

module.exports = GeneradorContenidoFalso;

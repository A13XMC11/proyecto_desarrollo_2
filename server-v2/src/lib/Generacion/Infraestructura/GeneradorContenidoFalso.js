const ErrorDelGenerador = require("../../Compartido/Dominio/Errores/ErrorDelGenerador");

const VOCALES = ["a", "e", "i", "o", "u"];
const TEMAS = { animales: "los animales", objetos_cotidianos: "los objetos de casa", naturaleza: "la naturaleza" };
const CONSIGNA_VOCALES = "¿Con qué vocal empieza esta palabra?";
const CONSIGNA_SILABAS = "Ordena las sílabas para formar la palabra";

// Generador sin IA: arma la actividad con fixtures a partir de los recursos del catálogo. Permite probar
// todo el flujo (cupo, validación, borrador, revisión) sin llamar a ningún proveedor ni gastar nada.
// Es determinista: la misma solicitud produce siempre la misma actividad.
class GeneradorContenidoFalso {
  async generar({ habilidad, tematica, cantidad, recursos }, { signal } = {}) {
    if (signal && signal.aborted) throw new ErrorDelGenerador("Generación cancelada", "GENERADOR_TIEMPO_AGOTADO");
    const ejercicios = habilidad === "vocales" ? this.vocales(recursos, cantidad) : this.silabas(recursos, cantidad);
    const titulo = `${habilidad === "vocales" ? "Vocales" : "Sílabas"}: ${TEMAS[tematica] || tematica}`;
    return { titulo, ejercicios, uso: { proveedor: "falso", modelo: "fixtures", tokensEntrada: 0, tokensSalida: 0 } };
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
        piezas,
        ordenCorrecto: piezas.map((p) => p.id)
      };
    });
  }
}

module.exports = GeneradorContenidoFalso;

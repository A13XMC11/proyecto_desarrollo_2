// Implementación de IGeneradorContenido sin proveedor real: arma ejercicios válidos a partir de los
// recursos del catálogo que recibe. Sirve para desarrollar y probar sin gastar tokens; el adaptador de
// Claude (GeneradorContenidoIA) se conecta en producción cambiando solo http/index.js.
const VOCALES = ["a", "e", "i", "o", "u"];
const TEMATICAS = { animales: "animales", objetos_cotidianos: "objetos de casa", naturaleza: "la naturaleza" };

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function ejercicioVocal(recurso, indice) {
  const correcta = recurso.vocalInicial;
  const pos = VOCALES.indexOf(correcta);
  const distractores = [VOCALES[(pos + 1) % 5], VOCALES[(pos + 3) % 5]];
  // La correcta no siempre en el mismo lugar
  const textos = [...distractores];
  textos.splice(indice % 3, 0, correcta);
  const opciones = textos.map((texto, i) => ({ id: `o${i + 1}`, texto }));
  return {
    id: `e${indice + 1}`,
    consigna: "¿Con qué vocal empieza esta palabra?",
    pista: "Di la palabra despacio y escucha el primer sonido.",
    // Lo que el niño ve en grande: la palabra, nunca la vocal (sería la respuesta)
    objetivo: recurso.palabra,
    recursoId: recurso.id,
    opciones,
    respuestaCorrectaId: opciones.find((o) => o.texto === correcta).id
  };
}

function ejercicioSilabas(recurso, indice) {
  const enOrden = recurso.silabas.map((texto, i) => ({ orden: i, texto }));
  // Se muestran rotadas una posición para que no aparezcan ya ordenadas
  const mostradas = [...enOrden.slice(1), enOrden[0]].map((s, i) => ({ ...s, id: `p${i + 1}` }));
  return {
    id: `e${indice + 1}`,
    consigna: "Ordena las sílabas para formar la palabra.",
    pista: "Empieza por la sílaba que suena primero.",
    objetivo: recurso.palabra,
    recursoId: recurso.id,
    palabraId: recurso.id,
    piezas: mostradas.map(({ id, texto }) => ({ id, texto })),
    ordenCorrecto: [...mostradas].sort((a, b) => a.orden - b.orden).map((s) => s.id)
  };
}

class GeneradorContenidoFalso {
  constructor({ demoraMs = 0 } = {}) {
    this.demoraMs = demoraMs;
  }

  async generar({ habilidad, tematica, cantidad, recursos = [] }) {
    if (this.demoraMs > 0) await esperar(this.demoraMs);
    if (recursos.length < cantidad) {
      const error = new Error(`El catálogo solo tiene ${recursos.length} palabras para esta actividad`);
      error.codigo = "CATALOGO_INSUFICIENTE";
      throw error;
    }

    const elegidos = recursos.slice(0, cantidad);
    const vocales = habilidad === "vocales";
    return {
      titulo: vocales ? `Vocales con ${TEMATICAS[tematica] || tematica}` : `Sílabas con ${TEMATICAS[tematica] || tematica}`,
      ejercicios: elegidos.map(vocales ? ejercicioVocal : ejercicioSilabas),
      uso: { proveedor: "falso", modelo: "catalogo-v1", tokensEntrada: 0, tokensSalida: 0 }
    };
  }
}

module.exports = GeneradorContenidoFalso;

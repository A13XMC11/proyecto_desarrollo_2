const NOMBRES = { vocales: "Vocales", palabras_silabas: "Palabras con sílabas", completar_silaba: "Completar la sílaba", contar_silabas: "Contar sílabas" };
const nombreDe = (habilidad) => NOMBRES[habilidad] || "otra habilidad";

// Redactor para desarrollo y pruebas (AI_PROVEEDOR=falso): arma el texto con las mismas cifras, sin llamar a nadie
// y sin consumo. Sirve para ver el flujo completo sin gastar.
class RedactorRecomendacionFalso {
  async redactar(analisis) {
    const marcadas = analisis.habilidades.filter((h) => h.repasar);
    const resumen = marcadas.length
      ? `Lo que más se dificultó: ${marcadas.map((h) => `${nombreDe(h.habilidad)} (${h.falloPrimerIntento} de ${h.respondidos} sin acertar al primer intento)`).join("; ")}.`
      : "Ninguna habilidad destaca por su dificultad en las partidas analizadas.";

    const sugerencias = [
      ...marcadas.slice(0, 2).map((h) => `Dedicar un rato del aula a repasar ${nombreDe(h.habilidad).toLowerCase()} con ejemplos en la pizarra.`),
      ...analisis.palabras.slice(0, 1).map((p) => `Trabajar la palabra «${p.objetivo}» en voz alta y con apoyo de dibujos.`)
    ];
    if (sugerencias.length === 0) sugerencias.push("Seguir con nuevas actividades y volver a revisar los resultados más adelante.");

    return { propuesta: { resumen, sugerencias }, uso: { proveedor: "falso", modelo: "falso", tokensEntrada: 0, tokensSalida: 0 } };
  }
}

module.exports = RedactorRecomendacionFalso;

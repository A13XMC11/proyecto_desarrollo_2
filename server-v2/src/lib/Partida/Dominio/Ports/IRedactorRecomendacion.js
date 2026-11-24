// Redacta la recomendación de repaso a partir del análisis ya calculado por el servidor (solo cifras agregadas).
//
// redactar(analisis, { signal }) devuelve
//   { propuesta: { resumen, sugerencias }, uso: { proveedor, modelo, tokensEntrada?, tokensSalida? } }
//
// Devuelve solo datos: la propuesta es no confiable y quien la pide la valida (RecomendacionRepaso).
// Si falla, lanza ErrorDelGenerador (con `uso` si el proveedor informó el consumo). Debe respetar `signal`.
class IRedactorRecomendacion {
  async redactar(analisis, { signal } = {}) {}
}

module.exports = IRedactorRecomendacion;

const { construirPromptRecomendacion } = require("./construirPromptRecomendacion");

// Redactor real: pide al proveedor de IA (cliente con redactarJson: Gemini u OpenAI) un JSON con el esquema de la
// recomendación. No valida el contenido: lo que devuelve el proveedor es una propuesta no confiable y la validan
// quienes la usan (RecomendacionRepaso).
class RedactorRecomendacionIA {
  constructor({ cliente } = {}) {
    if (!cliente || typeof cliente.redactarJson !== "function") throw new Error("RedactorRecomendacionIA requiere un cliente con redactarJson");
    this.cliente = cliente;
  }

  async redactar(analisis, { signal } = {}) {
    const { contenido, uso } = await this.cliente.redactarJson(construirPromptRecomendacion(analisis), { signal });
    return { propuesta: contenido, uso };
  }
}

module.exports = RedactorRecomendacionIA;

const ErrorDelGenerador = require("../../Compartido/Dominio/Errores/ErrorDelGenerador");
const GeneradorContenidoIA = require("./GeneradorContenidoIA");
const { adaptarEsquemaEstricto, quitarNulos } = require("./esquemaEstricto");

const URL_BASE = "https://api.openai.com";
const PROVEEDOR = "openai";
const NOMBRE_ESQUEMA = "respuesta_generacion";
const tokens = (n) => (Number.isInteger(n) && n >= 0 ? n : undefined);

// Generador real con OpenAI (Chat Completions + Structured Outputs estricto). Hereda de GeneradorContenidoIA todo
// lo que no depende del proveedor (armado de ejercicios, temática libre, validación); aquí solo va la llamada,
// la lectura de la respuesta y el consumo. Una sola llamada, sin reintentos, y los errores nunca incluyen la clave
// ni el cuerpo de la respuesta del proveedor.
class GeneradorContenidoOpenAI extends GeneradorContenidoIA {
  // esfuerzoRazonamiento (opcional): valor de reasoning_effort para modelos que razonan. Si no se define, no se
  // envía y el modelo usa el suyo. Los tokens de razonamiento cuentan dentro de maxTokensSalida.
  constructor({ esfuerzoRazonamiento, urlBase = URL_BASE, ...resto }) {
    super({ ...resto, urlBase });
    if (esfuerzoRazonamiento !== undefined && !/^[a-z]+$/.test(esfuerzoRazonamiento)) {
      throw new Error("esfuerzoRazonamiento debe ser una palabra en minúsculas (por ejemplo: low, medium, high)");
    }
    this.esfuerzoRazonamiento = esfuerzoRazonamiento;
  }

  async llamar({ sistema, usuario, esquema }, signal) {
    return this.enviarJson(
      `${this.urlBase}/v1/chat/completions`,
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.modelo,
        messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
        response_format: { type: "json_schema", json_schema: { name: NOMBRE_ESQUEMA, strict: true, schema: adaptarEsquemaEstricto(esquema) } },
        max_completion_tokens: this.maxTokensSalida,
        ...(this.esfuerzoRazonamiento !== undefined && { reasoning_effort: this.esfuerzoRazonamiento })
      },
      signal
    );
  }

  // Extrae el JSON de la primera opción. Un rechazo, un filtro o una respuesta cortada no sirven.
  leerContenido(respuesta, { lista = "ejercicios", soloCampos } = {}) {
    const opcion = respuesta?.choices?.[0];
    if (!opcion) throw new ErrorDelGenerador("El proveedor de IA no devolvió contenido", "GENERADOR_RESPUESTA_VACIA");
    if (opcion.message?.refusal || opcion.finish_reason === "content_filter") {
      throw new ErrorDelGenerador("El proveedor de IA bloqueó la solicitud", "GENERADOR_BLOQUEADO");
    }
    if (opcion.finish_reason && opcion.finish_reason !== "stop") {
      throw new ErrorDelGenerador(`El proveedor de IA no terminó la respuesta (${opcion.finish_reason})`, "GENERADOR_RESPUESTA_INCOMPLETA");
    }
    const texto = typeof opcion.message?.content === "string" ? opcion.message.content : "";
    return this.interpretarTexto(texto, { lista, soloCampos, normalizar: quitarNulos });
  }

  // completion_tokens ya incluye los tokens de razonamiento (se facturan como salida). Si falta algún dato se
  // omite: consumo desconocido.
  leerUso(respuesta) {
    const uso = { proveedor: PROVEEDOR, modelo: this.modelo };
    const entrada = tokens(respuesta?.usage?.prompt_tokens);
    const salida = tokens(respuesta?.usage?.completion_tokens);
    if (entrada !== undefined && salida !== undefined) {
      uso.tokensEntrada = entrada;
      uso.tokensSalida = salida;
    }
    return uso;
  }
}

module.exports = GeneradorContenidoOpenAI;

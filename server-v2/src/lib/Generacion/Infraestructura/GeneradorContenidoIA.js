const ErrorDelGenerador = require("../../Compartido/Dominio/Errores/ErrorDelGenerador");
const { construirPromptGeneracion } = require("./construirPromptGeneracion");

const URL_BASE = "https://generativelanguage.googleapis.com";
const PROVEEDOR = "gemini";
const tokens = (n) => (Number.isInteger(n) && n >= 0 ? n : undefined);

// Generador real: una sola llamada a Gemini (sin reintentos, el plan los fija en cero) que devuelve SOLO datos.
// La IA elige recursos del catálogo y redacta consignas y pistas; el servidor arma ids, opciones, piezas y la
// palabra objetivo. Lo que devuelve sigue siendo una propuesta no confiable que ProcesarGeneracion valida.
// Los mensajes de error nunca incluyen la clave ni el cuerpo de la respuesta del proveedor.
class GeneradorContenidoIA {
  // presupuestoRazonamiento (opcional): tope de tokens de razonamiento. Si no se define, no se envía y el modelo usa el suyo.
  constructor({ apiKey, modelo, maxTokensSalida, presupuestoRazonamiento, urlBase = URL_BASE, fetchFn = globalThis.fetch }) {
    if (!apiKey || !modelo) throw new Error("GeneradorContenidoIA requiere apiKey y modelo");
    if (!Number.isInteger(maxTokensSalida) || maxTokensSalida < 1) throw new Error("GeneradorContenidoIA requiere maxTokensSalida entero positivo");
    if (typeof fetchFn !== "function") throw new Error("GeneradorContenidoIA requiere fetch");
    if (presupuestoRazonamiento !== undefined && (!Number.isInteger(presupuestoRazonamiento) || presupuestoRazonamiento < 0)) {
      throw new Error("presupuestoRazonamiento debe ser un entero no negativo");
    }
    Object.assign(this, { apiKey, modelo, maxTokensSalida, presupuestoRazonamiento, urlBase, fetchFn });
  }

  async generar(solicitud, { signal } = {}) {
    const { sistema, usuario, esquema } = construirPromptGeneracion(solicitud);
    const respuesta = await this.llamar({ sistema, usuario, esquema }, signal);
    const uso = this.leerUso(respuesta);
    let contenido;
    try {
      contenido = this.leerContenido(respuesta);
    } catch (error) {
      // La llamada ya se hizo: si el proveedor informó el consumo, se conserva para no reservar de más
      if (error instanceof ErrorDelGenerador && uso.tokensEntrada !== undefined) error.uso = uso;
      throw error;
    }
    return {
      titulo: typeof contenido.titulo === "string" ? contenido.titulo.trim() : contenido.titulo,
      ejercicios: this.armarEjercicios(solicitud, contenido.ejercicios),
      uso
    };
  }

  async llamar({ sistema, usuario, esquema }, signal) {
    let http;
    try {
      http = await this.fetchFn(`${this.urlBase}/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: usuario }] }],
          generationConfig: {
            responseMimeType: "application/json", responseJsonSchema: esquema, maxOutputTokens: this.maxTokensSalida,
            ...(this.presupuestoRazonamiento !== undefined && { thinkingConfig: { thinkingBudget: this.presupuestoRazonamiento } })
          }
        }),
        signal
      });
    } catch (error) {
      if (signal && signal.aborted) throw new ErrorDelGenerador("Generación cancelada o fuera de tiempo", "GENERADOR_TIEMPO_AGOTADO");
      throw new ErrorDelGenerador("No se pudo contactar al proveedor de IA", "GENERADOR_ERROR");
    }
    if (!http.ok) throw new ErrorDelGenerador(`El proveedor de IA respondió con el estado ${http.status}`, "GENERADOR_ERROR");
    try {
      return await http.json();
    } catch (error) {
      throw new ErrorDelGenerador("La respuesta del proveedor de IA no es legible", "GENERADOR_RESPUESTA_INVALIDA");
    }
  }

  // Extrae el JSON del primer candidato; un bloqueo o una respuesta cortada no sirven
  leerContenido(respuesta) {
    if (respuesta?.promptFeedback?.blockReason) {
      throw new ErrorDelGenerador("El proveedor de IA bloqueó la solicitud", "GENERADOR_BLOQUEADO");
    }
    const candidato = respuesta?.candidates?.[0];
    if (!candidato) throw new ErrorDelGenerador("El proveedor de IA no devolvió contenido", "GENERADOR_RESPUESTA_VACIA");
    if (candidato.finishReason && candidato.finishReason !== "STOP") {
      throw new ErrorDelGenerador(`El proveedor de IA no terminó la respuesta (${candidato.finishReason})`, "GENERADOR_RESPUESTA_INCOMPLETA");
    }
    const texto = (candidato.content?.parts || []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
    let contenido;
    try {
      contenido = JSON.parse(texto);
    } catch (error) {
      throw new ErrorDelGenerador("El proveedor de IA no devolvió un JSON válido", "GENERADOR_RESPUESTA_INVALIDA");
    }
    if (!contenido || typeof contenido !== "object" || Array.isArray(contenido) || !Array.isArray(contenido.ejercicios)) {
      throw new ErrorDelGenerador("El JSON del proveedor de IA no tiene la forma esperada", "GENERADOR_RESPUESTA_INVALIDA");
    }
    return contenido;
  }

  // Los tokens de razonamiento se facturan como salida. Si falta algún dato, se omite: consumo desconocido.
  leerUso(respuesta) {
    const meta = respuesta?.usageMetadata || {};
    const entrada = tokens(meta.promptTokenCount);
    const salida = tokens(meta.candidatesTokenCount);
    const razonamiento = meta.thoughtsTokenCount === undefined ? 0 : tokens(meta.thoughtsTokenCount);
    const uso = { proveedor: PROVEEDOR, modelo: this.modelo };
    if (entrada !== undefined && salida !== undefined && razonamiento !== undefined) {
      uso.tokensEntrada = entrada;
      uso.tokensSalida = salida + razonamiento;
    }
    return uso;
  }

  armarEjercicios({ mecanica, recursos }, propuestos) {
    const porId = new Map(recursos.map((r) => [r.id, r]));
    return propuestos.map((e, i) => {
      const id = `e${i + 1}`;
      return mecanica === "seleccionar_opcion" ? this.ejercicioOpciones(id, e, porId) : this.ejercicioSilabas(id, e, porId);
    });
  }

  // Un id que no existe se deja pasar tal cual: la validación pedagógica lo rechaza como CONTENIDO_INVALIDO
  ejercicioOpciones(id, e, porId) {
    const recurso = porId.get(e?.recursoId);
    const vocales = Array.isArray(e?.vocalesOpciones) ? e.vocalesOpciones.map((v) => String(v)) : [];
    const textos = [...vocales].sort();
    const correcta = recurso ? textos.indexOf(recurso.vocalInicial) : -1;
    return {
      id,
      consigna: e?.consigna,
      ...(e?.pista ? { pista: e.pista } : {}),
      objetivo: recurso ? recurso.palabra : String(e?.recursoId),
      recursoId: e?.recursoId,
      opciones: textos.map((t, j) => ({ id: `o${j + 1}`, texto: t.toUpperCase() })),
      respuestaCorrectaId: `o${(correcta === -1 ? 0 : correcta) + 1}`
    };
  }

  ejercicioSilabas(id, e, porId) {
    const recurso = porId.get(e?.palabraId);
    const piezas = (recurso ? recurso.silabas : ["?"]).map((texto, j) => ({ id: `p${j + 1}`, texto }));
    return {
      id,
      consigna: e?.consigna,
      objetivo: recurso ? recurso.palabra : String(e?.palabraId),
      palabraId: e?.palabraId,
      piezas,
      ordenCorrecto: piezas.map((p) => p.id)
    };
  }
}

module.exports = GeneradorContenidoIA;

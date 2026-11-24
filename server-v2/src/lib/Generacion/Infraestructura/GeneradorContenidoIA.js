const ErrorDelGenerador = require("../../Compartido/Dominio/Errores/ErrorDelGenerador");
const { construirPromptGeneracion } = require("./construirPromptGeneracion");
const { completarSilaba, contarSilabas, conIcono } = require("./ejerciciosDeSilabas");
const { seleccionarEjerciciosLibres } = require("./armarEjerciciosLibres");

const URL_BASE = "https://generativelanguage.googleapis.com";
const PROVEEDOR = "gemini";
const tokens = (n) => (Number.isInteger(n) && n >= 0 ? n : undefined);

// En temática libre el título lo arma el servidor (no la IA): así no hace falta filtrarlo ni cabe una inyección en él
const TITULOS_LIBRES = { vocales: "Vocales", palabras_silabas: "Sílabas", completar_silaba: "La sílaba que falta", contar_silabas: "Cuenta las sílabas" };

// Generador real: una sola llamada a Gemini (sin reintentos, el plan los fija en cero) que devuelve SOLO datos.
// La IA elige recursos del catálogo y redacta consignas y pistas; el servidor arma ids, opciones, piezas y la
// palabra objetivo. Lo que devuelve sigue siendo una propuesta no confiable que ProcesarGeneracion valida.
// Los mensajes de error nunca incluyen la clave ni el cuerpo de la respuesta del proveedor.
class GeneradorContenidoIA {
  // presupuestoRazonamiento (opcional): tope de tokens de razonamiento. Si no se define, no se envía y el modelo usa el suyo.
  // filtroContenido (IFiltroContenido) y emojisPermitidos (IEmojisPermitidos): solo los usa la temática libre.
  constructor({ apiKey, modelo, maxTokensSalida, presupuestoRazonamiento, filtroContenido, emojisPermitidos, urlBase = URL_BASE, fetchFn = globalThis.fetch }) {
    if (!apiKey || !modelo) throw new Error("GeneradorContenidoIA requiere apiKey y modelo");
    if (!Number.isInteger(maxTokensSalida) || maxTokensSalida < 1) throw new Error("GeneradorContenidoIA requiere maxTokensSalida entero positivo");
    if (typeof fetchFn !== "function") throw new Error("GeneradorContenidoIA requiere fetch");
    if (presupuestoRazonamiento !== undefined && (!Number.isInteger(presupuestoRazonamiento) || presupuestoRazonamiento < 0)) {
      throw new Error("presupuestoRazonamiento debe ser un entero no negativo");
    }
    Object.assign(this, { apiKey, modelo, maxTokensSalida, presupuestoRazonamiento, filtroContenido, emojisPermitidos, urlBase, fetchFn });
  }

  async generar(solicitud, { signal } = {}) {
    const libre = solicitud.modoTematica === "libre";
    // Sin estas dependencias no se podría validar lo que proponga la IA: se detiene ANTES de llamar (y de gastar)
    if (libre && (!this.filtroContenido || !this.emojisPermitidos)) {
      throw new Error("GeneradorContenidoIA requiere filtroContenido y emojisPermitidos para la temática libre");
    }
    const { sistema, usuario, esquema } = construirPromptGeneracion(solicitud);
    const respuesta = await this.llamar({ sistema, usuario, esquema }, signal);
    const uso = this.leerUso(respuesta);
    let contenido;
    try {
      contenido = libre ? this.leerContenido(respuesta, { lista: "candidatas", soloCampos: ["candidatas"] }) : this.leerContenido(respuesta);
      if (libre) return { titulo: this.tituloLibre(solicitud), ejercicios: this.seleccionarLibres(solicitud, contenido.candidatas), uso };
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
    return this.enviarJson(
      `${this.urlBase}/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`,
      { "x-goog-api-key": this.apiKey },
      {
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: usuario }] }],
        generationConfig: {
          responseMimeType: "application/json", responseJsonSchema: esquema, maxOutputTokens: this.maxTokensSalida,
          ...(this.presupuestoRazonamiento !== undefined && { thinkingConfig: { thinkingBudget: this.presupuestoRazonamiento } })
        }
      },
      signal
    );
  }

  // POST con cuerpo JSON y respuesta JSON, común a todos los proveedores. Los errores nunca incluyen la clave
  // ni el cuerpo de la respuesta del proveedor.
  async enviarJson(url, cabeceras, cuerpo, signal) {
    let http;
    try {
      http = await this.fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...cabeceras },
        body: JSON.stringify(cuerpo),
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

  tituloLibre({ habilidad, tematica }) {
    return `${TITULOS_LIBRES[habilidad]}: ${tematica}`;
  }

  // Candidatas de la IA -> ejercicios, con todo lo demás calculado por el servidor
  seleccionarLibres({ habilidad, mecanica, tematica, cantidad }, candidatas) {
    return seleccionarEjerciciosLibres({
      habilidad, mecanica, tematica, cantidad, candidatas, filtroContenido: this.filtroContenido, emojisPermitidos: this.emojisPermitidos
    });
  }

  // Extrae el JSON del primer candidato; un bloqueo o una respuesta cortada no sirven.
  // `lista` es la propiedad que debe ser una lista; con `soloCampos` cualquier otra propiedad invalida la respuesta
  // (en el catálogo los campos extra se descartan; en la temática libre se rechaza la respuesta entera).
  leerContenido(respuesta, { lista = "ejercicios", soloCampos } = {}) {
    if (respuesta?.promptFeedback?.blockReason) {
      throw new ErrorDelGenerador("El proveedor de IA bloqueó la solicitud", "GENERADOR_BLOQUEADO");
    }
    const candidato = respuesta?.candidates?.[0];
    if (!candidato) throw new ErrorDelGenerador("El proveedor de IA no devolvió contenido", "GENERADOR_RESPUESTA_VACIA");
    if (candidato.finishReason && candidato.finishReason !== "STOP") {
      throw new ErrorDelGenerador(`El proveedor de IA no terminó la respuesta (${candidato.finishReason})`, "GENERADOR_RESPUESTA_INCOMPLETA");
    }
    const texto = (candidato.content?.parts || []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
    return this.interpretarTexto(texto, { lista, soloCampos });
  }

  // Del texto que devolvió el proveedor al objeto con la forma esperada. `normalizar` limpia el objeto ya leído
  // (un proveedor puede, por ejemplo, rellenar con null los campos opcionales) antes de comprobar su forma.
  interpretarTexto(texto, { lista = "ejercicios", soloCampos, normalizar = (x) => x } = {}) {
    let contenido;
    try {
      contenido = normalizar(JSON.parse(texto));
    } catch (error) {
      throw new ErrorDelGenerador("El proveedor de IA no devolvió un JSON válido", "GENERADOR_RESPUESTA_INVALIDA");
    }
    if (!contenido || typeof contenido !== "object" || Array.isArray(contenido) || !Array.isArray(contenido[lista])) {
      throw new ErrorDelGenerador("El JSON del proveedor de IA no tiene la forma esperada", "GENERADOR_RESPUESTA_INVALIDA");
    }
    if (soloCampos && Object.keys(contenido).some((campo) => !soloCampos.includes(campo))) {
      throw new ErrorDelGenerador("El JSON del proveedor de IA trae campos fuera del esquema", "GENERADOR_RESPUESTA_INVALIDA");
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

  armarEjercicios({ habilidad, recursos }, propuestos) {
    const porId = new Map(recursos.map((r) => [r.id, r]));
    const armar = {
      vocales: (id, e) => this.ejercicioOpciones(id, e, porId),
      completar_silaba: (id, e, i) => this.ejercicioCompletar(id, e, porId, recursos, i),
      contar_silabas: (id, e) => this.ejercicioContar(id, e, porId)
    }[habilidad] || ((id, e) => this.ejercicioSilabas(id, e, porId));
    return propuestos.map((e, i) => armar(`e${i + 1}`, e, i));
  }

  // Si la IA nombra una palabra que no existe, el ejercicio sale con ese id para que la validación lo rechace como CONTENIDO_INVALIDO
  ejercicioDesconocido(id, e) {
    return {
      id, consigna: e?.consigna, objetivo: String(e?.recursoId), recursoId: e?.recursoId,
      opciones: [{ id: "o1", texto: "a" }, { id: "o2", texto: "e" }, { id: "o3", texto: "i" }], respuestaCorrectaId: "o1"
    };
  }

  ejercicioCompletar(id, e, porId, recursos, posicion) {
    const recurso = porId.get(e?.recursoId);
    if (!recurso) return this.ejercicioDesconocido(id, e);
    const pista = e?.pista || undefined;
    if (!Number.isInteger(e?.indiceFaltante) || e.indiceFaltante < 0 || e.indiceFaltante >= recurso.silabas.length) {
      // Un hueco que no existe: sin marca, la validación lo rechaza
      const opciones = recurso.silabas.slice(0, 3).map((texto, j) => ({ id: `o${j + 1}`, texto }));
      return { id, consigna: e?.consigna, ...(pista ? { pista } : {}), objetivo: recurso.silabas.join(" "), recursoId: recurso.id, ...conIcono(recurso), opciones, respuestaCorrectaId: "o1" };
    }
    return completarSilaba({ id, recurso, indice: e.indiceFaltante, consigna: e.consigna, pista, recursos, semilla: posicion });
  }

  ejercicioContar(id, e, porId) {
    const recurso = porId.get(e?.recursoId);
    if (!recurso) return this.ejercicioDesconocido(id, e);
    return contarSilabas({ id, recurso, consigna: e.consigna, pista: e?.pista || undefined });
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
      ...conIcono(recurso),
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
      ...conIcono(recurso),
      piezas,
      ordenCorrecto: piezas.map((p) => p.id)
    };
  }
}

module.exports = GeneradorContenidoIA;

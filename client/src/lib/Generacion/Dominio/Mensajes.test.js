import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mensajeDeError } from "./Mensajes.js";
import { MOTIVOS_GENERACION } from "../../Juego/Dominio/ValoresPermitidos.js";

const error = (codigo, message = "mensaje del servidor", estado = 400) => Object.assign(new Error(message), { codigo, estado });

describe("mensajeDeError: códigos nuevos y existentes de la generación", () => {
  const CODIGOS = [
    "GENERACION_LIBRE_DESHABILITADA", "GENERACION_DESHABILITADA", "TEMATICA_NO_PERMITIDA", "CONTENIDO_INVALIDO",
    "GENERADOR_CANDIDATAS_INSUFICIENTES", "CLAVE_REUTILIZADA", "CUPO_DIARIO_AGOTADO", "GENERACION_EN_CURSO", "PRESUPUESTO_AGOTADO"
  ];

  it("cada código tiene un mensaje propio en español, no el del servidor", () => {
    for (const codigo of CODIGOS) {
      const texto = mensajeDeError(error(codigo, "MENSAJE-CRUDO"));
      assert.ok(texto && texto !== "MENSAJE-CRUDO", codigo);
      assert.match(texto, /[a-záéíóú]{4}/i, codigo);
    }
  });

  it("GENERADOR_CANDIDATAS_INSUFICIENTES explica el problema, sugiere qué hacer y avisa que cuenta como una del día", () => {
    const texto = mensajeDeError(error("GENERADOR_CANDIDATAS_INSUFICIENTES"));
    assert.match(texto, /suficientes palabras válidas/);
    assert.match(texto, /otra temática/);
    assert.match(texto, /palabras más comunes/);
    assert.match(texto, /cuenta como una de las generaciones del día/);
  });

  it("temática bloqueada: mensaje general, sin repetir lo escrito ni lo que diga el servidor", () => {
    const texto = mensajeDeError(error("TEMATICA_NO_PERMITIDA", "La temática «pistolas» no está permitida"));
    assert.ok(!/pistola/i.test(texto));
    assert.match(texto, /no es adecuada/i);
  });

  it("los rechazos de contenido al guardar tampoco repiten nada", () => {
    for (const codigo of ["PALABRA_NO_PERMITIDA", "TEXTO_NO_PERMITIDO"]) {
      const texto = mensajeDeError(error(codigo, "contiene «arma»"));
      assert.ok(!/arma/i.test(texto), codigo);
    }
  });

  it("el interruptor apagado se explica y se diferencia de la IA apagada", () => {
    assert.match(mensajeDeError(error("GENERACION_LIBRE_DESHABILITADA", "x", 503)), /otra temática/i);
    assert.notEqual(mensajeDeError(error("GENERACION_LIBRE_DESHABILITADA")), mensajeDeError(error("GENERACION_DESHABILITADA")));
  });

  it("cupo agotado y generación simultánea dicen qué pasó y qué hacer", () => {
    assert.match(mensajeDeError(error("CUPO_DIARIO_AGOTADO", "x", 429)), /mañana/i);
    assert.match(mensajeDeError(error("GENERACION_EN_CURSO", "x", 429)), /espera/i);
  });

  it("una clave reutilizada se explica como un envío repetido con datos distintos", () => {
    assert.match(mensajeDeError(error("CLAVE_REUTILIZADA", "x", 409)), /vuelve a pedirla/i);
  });

  it("un código desconocido usa el mensaje del servidor; sin mensaje, uno genérico", () => {
    assert.equal(mensajeDeError(error("OTRO_CODIGO", "Falta el título")), "Falta el título");
    assert.match(mensajeDeError({}), /Algo salió mal/);
    assert.match(mensajeDeError(null), /Algo salió mal/);
  });

  it("sin conexión conserva el mensaje del cliente", () => {
    assert.equal(mensajeDeError(Object.assign(new Error("No hay conexión con el servidor."), { estado: 0 })), "No hay conexión con el servidor.");
  });
});

describe("MOTIVOS_GENERACION (por qué falló una generación guardada)", () => {
  it("tiene los códigos con los que un servidor puede cerrar una generación libre", () => {
    for (const c of ["CONTENIDO_INVALIDO", "GENERADOR_CANDIDATAS_INSUFICIENTES", "GENERACION_DESHABILITADA", "GENERACION_EN_CURSO", "CUPO_DIARIO_AGOTADO"]) {
      assert.equal(typeof MOTIVOS_GENERACION[c], "string", c);
    }
  });
  it("coincide con lo que muestra mensajeDeError", () => {
    assert.equal(mensajeDeError(error("GENERADOR_CANDIDATAS_INSUFICIENTES")), MOTIVOS_GENERACION.GENERADOR_CANDIDATAS_INSUFICIENTES);
  });
});

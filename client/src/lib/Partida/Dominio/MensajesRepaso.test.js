import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mensajeDeRecomendacion } from "./MensajesRepaso.js";

const error = (codigo, message = "MENSAJE-CRUDO", estado = 400) => Object.assign(new Error(message), { codigo, estado });

describe("mensajeDeRecomendacion", () => {
  it("cada código esperado tiene un mensaje propio en español, no el del servidor", () => {
    for (const codigo of ["RECOMENDACION_DESHABILITADA", "DATOS_INSUFICIENTES", "RECOMENDACIONES_AGOTADAS", "PRESUPUESTO_AGOTADO", "GENERADOR_ERROR", "GENERADOR_TIEMPO_AGOTADO", "GENERADOR_RESPUESTA_INVALIDA", "GENERADOR_BLOQUEADO"]) {
      const texto = mensajeDeRecomendacion(error(codigo));
      assert.ok(texto && texto !== "MENSAJE-CRUDO", codigo);
    }
  });

  it("explica que agotar el cupo se renueva cada mes y que un fallo de la IA se puede reintentar", () => {
    assert.match(mensajeDeRecomendacion(error("RECOMENDACIONES_AGOTADAS")), /mes/);
    assert.match(mensajeDeRecomendacion(error("GENERADOR_ERROR")), /intentar/i);
  });

  it("un fallo de conexión conserva su mensaje y un código desconocido usa uno general", () => {
    assert.equal(mensajeDeRecomendacion(Object.assign(new Error("Sin internet"), { estado: 0 })), "Sin internet");
    assert.match(mensajeDeRecomendacion(error("OTRO")), /No se pudo/);
    assert.match(mensajeDeRecomendacion(null), /No se pudo/);
  });
});

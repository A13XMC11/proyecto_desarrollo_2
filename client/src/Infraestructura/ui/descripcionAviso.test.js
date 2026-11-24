import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describirAviso } from "./descripcionAviso.js";
import { AVISOS_CORREGIR } from "../../lib/Juego/Dominio/MensajesRevision.js";

describe("describirAviso: un error no depende solo del color", () => {
  it("un error se anuncia de inmediato (role alert) y lleva la palabra «Error» antes del texto", () => {
    const d = describirAviso("error");
    assert.equal(d.rol, "alert");
    assert.equal(d.region, "assertive");
    assert.match(d.prefijo, /^Error/);
  });

  it("un aviso de éxito se anuncia con calma (status) y dice «Listo»", () => {
    const d = describirAviso("exito");
    assert.equal(d.rol, "status");
    assert.equal(d.region, "polite");
    assert.match(d.prefijo, /^Listo/);
  });

  it("un tipo desconocido se trata como éxito, nunca como error silencioso", () => {
    assert.equal(describirAviso("otro").rol, "status");
  });
});

describe("avisos de corrección del editor", () => {
  it("no remiten al color: dicen dónde mirar con palabras", () => {
    for (const texto of Object.values(AVISOS_CORREGIR)) {
      assert.ok(!/\b(rojo|roja|rojos|rojas|verde|color)\b/i.test(texto), texto);
      assert.match(texto, /aviso|mensaje|indica/i);
    }
  });
});

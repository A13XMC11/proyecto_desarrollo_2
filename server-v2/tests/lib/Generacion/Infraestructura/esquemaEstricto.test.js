const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { adaptarEsquemaEstricto, quitarNulos } = require("../../../../src/lib/Generacion/Infraestructura/esquemaEstricto");
const { esquemaRespuesta, esquemaRespuestaLibre } = require("../../../../src/lib/Generacion/Infraestructura/construirPromptGeneracion");

// Recorre el esquema y devuelve las violaciones de las reglas del modo estricto de OpenAI
function violaciones(esquema, ruta = "$") {
  const malas = [];
  if (esquema && typeof esquema === "object") {
    if ("minLength" in esquema || "maxLength" in esquema) malas.push(`${ruta}: minLength/maxLength`);
    if (esquema.type === "object" && esquema.properties) {
      if (esquema.additionalProperties !== false) malas.push(`${ruta}: falta additionalProperties:false`);
      const claves = Object.keys(esquema.properties).sort();
      if (JSON.stringify([...(esquema.required || [])].sort()) !== JSON.stringify(claves)) malas.push(`${ruta}: required no lista todas las propiedades`);
      for (const [n, h] of Object.entries(esquema.properties)) malas.push(...violaciones(h, `${ruta}.${n}`));
    }
    if (esquema.items) malas.push(...violaciones(esquema.items, `${ruta}[]`));
  }
  return malas;
}

describe("adaptarEsquemaEstricto", () => {
  it("todo objeto declara additionalProperties:false y lista todas sus propiedades en required", () => {
    const adaptado = adaptarEsquemaEstricto({ type: "object", properties: { a: { type: "string", minLength: 1, maxLength: 5 }, b: { type: "integer" } }, required: ["a"] });
    assert.deepEqual(violaciones(adaptado), []);
    assert.deepEqual(adaptado.required, ["a", "b"]);
  });

  it("lo opcional admite null y conserva su enum con null incluido", () => {
    const adaptado = adaptarEsquemaEstricto({ type: "object", properties: { x: { type: "string", enum: ["a", "b"] }, y: { type: "string" } }, required: ["y"] });
    assert.deepEqual(adaptado.properties.x.type, ["string", "null"]);
    assert.deepEqual(adaptado.properties.x.enum, ["a", "b", null]);
    assert.equal(adaptado.properties.y.type, "string", "lo obligatorio no cambia");
  });

  it("no muta el esquema original", () => {
    const original = { type: "object", properties: { a: { type: "string", maxLength: 3 } }, required: [] };
    const copia = JSON.parse(JSON.stringify(original));
    adaptarEsquemaEstricto(original);
    assert.deepEqual(original, copia);
  });

  it("los esquemas reales de todas las habilidades y de la temática libre cumplen el modo estricto", () => {
    const ids = ["abeja", "oso", "urraca"];
    for (const habilidad of ["vocales", "palabras_silabas", "completar_silaba", "contar_silabas"]) {
      for (const cantidad of [5, 10]) {
        assert.deepEqual(violaciones(adaptarEsquemaEstricto(esquemaRespuesta(habilidad, cantidad, ids))), [], `${habilidad} x${cantidad}`);
      }
    }
    assert.deepEqual(violaciones(adaptarEsquemaEstricto(esquemaRespuestaLibre(5))), []);
  });

  it("conserva lo que sí admite el modo estricto: enum, minItems/maxItems y mínimos", () => {
    const adaptado = adaptarEsquemaEstricto(esquemaRespuesta("completar_silaba", 5, ["abeja"]));
    const ejercicios = adaptado.properties.ejercicios;
    assert.equal(ejercicios.minItems, 5);
    assert.equal(ejercicios.maxItems, 5);
    assert.deepEqual(ejercicios.items.properties.recursoId.enum, ["abeja"]);
    assert.equal(ejercicios.items.properties.indiceFaltante.minimum, 0);
  });
});

describe("quitarNulos", () => {
  it("quita los null en cualquier nivel y deja el resto igual", () => {
    assert.deepEqual(quitarNulos({ a: 1, b: null, c: [{ d: null, e: "x" }, null] }), { a: 1, c: [{ e: "x" }, null] });
  });
});

// Recursos del catálogo que una generación puede usar según la habilidad (§7.4.1):
// - vocales: palabras que empiezan con vocal
// - palabras_silabas: palabras de 2 a 3 sílabas
const MAX_SILABAS = 3;

function recursosParaGeneracion(catalogo, { habilidad, tematica }) {
  const recursos = catalogo.listar({ tematica });
  if (habilidad === "vocales") return recursos.filter((r) => r.vocalInicial);
  return recursos.filter((r) => r.silabas.length <= MAX_SILABAS);
}

module.exports = { recursosParaGeneracion };

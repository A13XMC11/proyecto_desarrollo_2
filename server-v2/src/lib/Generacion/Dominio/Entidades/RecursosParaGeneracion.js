// Recursos del catálogo que una generación puede usar según la habilidad (§7.4.1):
// - vocales: palabras que empiezan con vocal
// - palabras_silabas: palabras de 2 a 3 sílabas (se ordenan con pulsaciones: más piezas serían difíciles)
// - completar_silaba y contar_silabas: palabras de 2 a 4 sílabas
const MAX_SILABAS_ORDENAR = 3;
const MAX_SILABAS_LEER = 4;

function recursosParaGeneracion(catalogo, { habilidad, tematica }) {
  const recursos = catalogo.listar({ tematica });
  if (habilidad === "vocales") return recursos.filter((r) => r.vocalInicial);
  if (habilidad === "completar_silaba" || habilidad === "contar_silabas") {
    return recursos.filter((r) => r.silabas.length <= MAX_SILABAS_LEER);
  }
  return recursos.filter((r) => r.silabas.length <= MAX_SILABAS_ORDENAR);
}

module.exports = { recursosParaGeneracion };

// Genera el borrador de una actividad a partir de una solicitud ya validada.
//
// generar(solicitud, { signal }) recibe
//   { habilidad, mecanica, tematica, cantidad, franjaEdad?, instruccion?, recursos: [recurso del catálogo] }
// y devuelve
//   { titulo, ejercicios: [contrato de ejercicio], uso: { proveedor, modelo, tokensEntrada?, tokensSalida? } }
//
// Devuelve solo datos, nunca código. Lo que entrega es una propuesta no confiable: el servidor la valida
// contra el catálogo antes de guardarla. Si falla, lanza ErrorDelGenerador. Debe respetar `signal`.
// Si el proveedor no informa tokens, se omiten (no se informan como cero: el consumo es desconocido).
class IGeneradorContenido {
  async generar(solicitud, { signal } = {}) {}
}

module.exports = IGeneradorContenido;

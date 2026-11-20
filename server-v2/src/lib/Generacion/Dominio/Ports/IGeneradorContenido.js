// Genera el contenido de una actividad a partir de los parámetros pedidos por el docente.
// Recibe { habilidad, mecanica, tematica, cantidad, instruccion, recursos } donde recursos es la lista
// del catálogo revisado que se puede usar (la IA no inventa palabras). Nunca recibe datos de estudiantes.
//
// Devuelve { titulo, ejercicios, uso } con:
//   - ejercicios: datos con el contrato de Ejercicio (sin código ejecutable)
//   - uso: { proveedor, modelo, tokensEntrada?, tokensSalida?, usoDesconocido? }
// Si falla lanza un Error con `codigo` (por ejemplo PROVEEDOR_ERROR) y, si se conoce, `uso`.
class IGeneradorContenido {
  async generar(solicitud) {}
}

module.exports = IGeneradorContenido;

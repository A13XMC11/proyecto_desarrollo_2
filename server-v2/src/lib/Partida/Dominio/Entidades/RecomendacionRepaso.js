const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { textoPlano } = require("../../../Compartido/Dominio/Validaciones");

const MAX_SUGERENCIAS = 3;

// Recomendación de repaso redactada por la IA para el docente. Lo que devuelve el proveedor es una propuesta
// no confiable: solo se conservan estos dos campos, como texto plano y de largo acotado.
class RecomendacionRepaso {
  constructor(propuesta) {
    if (!propuesta || typeof propuesta !== "object" || Array.isArray(propuesta)) throw new EntradaInvalida("recomendación inválida");
    const { resumen, sugerencias } = propuesta;
    if (!Array.isArray(sugerencias) || sugerencias.length < 1 || sugerencias.length > MAX_SUGERENCIAS) {
      throw new EntradaInvalida(`sugerencias debe tener de 1 a ${MAX_SUGERENCIAS} elementos`);
    }
    this.resumen = textoPlano(resumen, "resumen", { min: 10, max: 500, requerido: true });
    this.sugerencias = sugerencias.map((s, i) => textoPlano(s, `sugerencias[${i}]`, { min: 5, max: 200, requerido: true }));
  }
}

module.exports = RecomendacionRepaso;

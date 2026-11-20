const FILTROS = ["cursoId", "estudianteId", "habilidad", "juegoId", "desde", "hasta"];

class ResultadoController {
  constructor({ consultarResultados, obtenerResumenInicio }) {
    this.consultarResultados = consultarResultados;
    this.obtenerResumenInicio = obtenerResumenInicio;
  }

  // Solo se aceptan filtros conocidos y de tipo texto (nunca objetos: evita operadores de MongoDB)
  resultados = async (req, res) => {
    const filtros = {};
    for (const campo of FILTROS) {
      if (typeof req.query[campo] === "string" && req.query[campo] !== "") filtros[campo] = req.query[campo];
    }
    res.json(await this.consultarResultados.ejecutar(req.docenteId, filtros));
  };

  inicio = async (req, res) => {
    res.json(await this.obtenerResumenInicio.ejecutar(req.docenteId));
  };
}

module.exports = ResultadoController;

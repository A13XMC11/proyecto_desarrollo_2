const FILTROS = ["cursoId", "estudianteId", "habilidad", "juegoId", "desde", "hasta"];

class ResultadoController {
  constructor({ consultarResultados, sugerirRepaso, obtenerResumenInicio }) {
    this.consultarResultados = consultarResultados;
    this.sugerirRepaso = sugerirRepaso;
    this.obtenerResumenInicio = obtenerResumenInicio;
  }

  // Solo se aceptan filtros conocidos y de tipo texto (nunca objetos: evita operadores de MongoDB)
  filtrosDe(query) {
    const filtros = {};
    for (const campo of FILTROS) {
      if (typeof query[campo] === "string" && query[campo] !== "") filtros[campo] = query[campo];
    }
    return filtros;
  }

  resultados = async (req, res) => {
    res.json(await this.consultarResultados.ejecutar(req.docenteId, this.filtrosDe(req.query)));
  };

  repaso = async (req, res) => {
    res.json(await this.sugerirRepaso.ejecutar(req.docenteId, this.filtrosDe(req.query)));
  };

  inicio = async (req, res) => {
    res.json(await this.obtenerResumenInicio.ejecutar(req.docenteId));
  };
}

module.exports = ResultadoController;

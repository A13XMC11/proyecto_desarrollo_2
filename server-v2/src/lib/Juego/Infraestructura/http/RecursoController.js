class RecursoController {
  constructor({ listarRecursos }) {
    this.listarRecursos = listarRecursos;
  }

  listar = async (req, res) => {
    res.json(await this.listarRecursos.ejecutar({ tematica: req.query.tematica }));
  };
}

module.exports = RecursoController;

class CursoController {
  constructor({ crearCurso, listarCursos, obtenerCursoPorId, actualizarCurso, archivarCurso }) {
    this.crearCurso = crearCurso;
    this.listarCursos = listarCursos;
    this.obtenerCursoPorId = obtenerCursoPorId;
    this.actualizarCurso = actualizarCurso;
    this.archivarCurso = archivarCurso;
  }

  crear = async (req, res) => {
    const curso = await this.crearCurso.ejecutar(req.docenteId, req.body);
    res.status(201).json(curso);
  };

  listar = async (req, res) => {
    const archivado = req.query.archivado === undefined ? undefined : req.query.archivado === "true";
    res.json(await this.listarCursos.ejecutar(req.docenteId, { archivado }));
  };

  obtenerPorId = async (req, res) => {
    res.json(await this.obtenerCursoPorId.ejecutar(req.docenteId, req.params.id));
  };

  actualizar = async (req, res) => {
    res.json(await this.actualizarCurso.ejecutar(req.docenteId, req.params.id, req.body));
  };

  // DELETE archiva: no hay borrado físico
  eliminar = async (req, res) => {
    await this.archivarCurso.ejecutar(req.docenteId, req.params.id);
    res.status(204).send();
  };
}

module.exports = CursoController;

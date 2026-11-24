class CursoController {
  constructor({ crearCurso, listarCursos, obtenerCursoPorId, actualizarCurso, archivarCurso, generarCodigoAcceso, revocarCodigoAcceso }) {
    this.crearCurso = crearCurso;
    this.listarCursos = listarCursos;
    this.obtenerCursoPorId = obtenerCursoPorId;
    this.actualizarCurso = actualizarCurso;
    this.archivarCurso = archivarCurso;
    this.generarCodigoAcceso = generarCodigoAcceso;
    this.revocarCodigoAcceso = revocarCodigoAcceso;
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

  // Abre el acceso de estudiantes (o cambia el código, lo que invalida el anterior)
  generarCodigo = async (req, res) => {
    res.json(await this.generarCodigoAcceso.ejecutar(req.docenteId, req.params.id));
  };

  revocarCodigo = async (req, res) => {
    res.json(await this.revocarCodigoAcceso.ejecutar(req.docenteId, req.params.id));
  };

  // DELETE archiva: no hay borrado físico
  eliminar = async (req, res) => {
    await this.archivarCurso.ejecutar(req.docenteId, req.params.id);
    res.status(204).send();
  };
}

module.exports = CursoController;

class EstudianteController {
  constructor({ crearEstudiante, listarEstudiantes, obtenerEstudiantePorId, actualizarEstudiante, archivarEstudiante }) {
    this.crearEstudiante = crearEstudiante;
    this.listarEstudiantes = listarEstudiantes;
    this.obtenerEstudiantePorId = obtenerEstudiantePorId;
    this.actualizarEstudiante = actualizarEstudiante;
    this.archivarEstudiante = archivarEstudiante;
  }

  crear = async (req, res) => {
    const estudiante = await this.crearEstudiante.ejecutar(req.docenteId, req.body);
    res.status(201).json(estudiante);
  };

  // GET /api/estudiantes?cursoId=...&archivado=true|false
  listar = async (req, res) => {
    const archivado = req.query.archivado === undefined ? undefined : req.query.archivado === "true";
    res.json(await this.listarEstudiantes.ejecutar(req.docenteId, req.query.cursoId, { archivado }));
  };

  obtenerPorId = async (req, res) => {
    res.json(await this.obtenerEstudiantePorId.ejecutar(req.docenteId, req.params.id));
  };

  actualizar = async (req, res) => {
    res.json(await this.actualizarEstudiante.ejecutar(req.docenteId, req.params.id, req.body));
  };

  // DELETE archiva: no hay borrado físico
  eliminar = async (req, res) => {
    await this.archivarEstudiante.ejecutar(req.docenteId, req.params.id);
    res.status(204).send();
  };
}

module.exports = EstudianteController;

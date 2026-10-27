class DocenteController {
  constructor({ registrarDocente, listarDocentes, obtenerDocentePorId, actualizarDocente, eliminarDocente }) {
    this.registrarDocente = registrarDocente;
    this.listarDocentes = listarDocentes;
    this.obtenerDocentePorId = obtenerDocentePorId;
    this.actualizarDocente = actualizarDocente;
    this.eliminarDocente = eliminarDocente;
  }

  registrar = async (req, res) => {
    const docente = await this.registrarDocente.ejecutar(req.body);
    res.status(201).json(docente);
  };

  listar = async (req, res) => {
    res.json(await this.listarDocentes.ejecutar(req.docenteId));
  };

  obtenerPorId = async (req, res) => {
    const docente = await this.obtenerDocentePorId.ejecutar(req.docenteId, req.params.id);
    res.json(docente);
  };

  actualizar = async (req, res) => {
    const docente = await this.actualizarDocente.ejecutar(req.docenteId, req.params.id, req.body);
    res.json(docente);
  };

  eliminar = async (req, res) => {
    await this.eliminarDocente.ejecutar(req.docenteId, req.params.id);
    res.status(204).send();
  };
}

module.exports = DocenteController;

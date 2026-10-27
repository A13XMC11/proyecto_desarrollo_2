class VersionController {
  constructor({ crearVersion, listarVersiones, obtenerVersion, actualizarVersion, aprobarVersion, descartarVersion }) {
    this.crearVersion = crearVersion;
    this.listarVersiones = listarVersiones;
    this.obtenerVersion = obtenerVersion;
    this.actualizarVersion = actualizarVersion;
    this.aprobarVersion = aprobarVersion;
    this.descartarVersion = descartarVersion;
  }

  crear = async (req, res) => {
    const version = await this.crearVersion.ejecutar(req.docenteId, req.params.juegoId, req.body);
    res.status(201).json(version);
  };

  listar = async (req, res) => {
    res.json(await this.listarVersiones.ejecutar(req.docenteId, req.params.juegoId));
  };

  obtenerPorId = async (req, res) => {
    res.json(await this.obtenerVersion.ejecutar(req.docenteId, req.params.juegoId, req.params.id));
  };

  actualizar = async (req, res) => {
    res.json(await this.actualizarVersion.ejecutar(req.docenteId, req.params.juegoId, req.params.id, req.body));
  };

  aprobar = async (req, res) => {
    res.json(await this.aprobarVersion.ejecutar(req.docenteId, req.params.juegoId, req.params.id));
  };

  // DELETE descarta el borrador: una versión aprobada no se elimina
  eliminar = async (req, res) => {
    await this.descartarVersion.ejecutar(req.docenteId, req.params.juegoId, req.params.id);
    res.status(204).send();
  };
}

module.exports = VersionController;

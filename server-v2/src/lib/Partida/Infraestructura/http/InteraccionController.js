class InteraccionController {
  constructor({ registrarInteraccion, listarInteracciones }) {
    this.registrarInteraccion = registrarInteraccion;
    this.listarInteracciones = listarInteracciones;
  }

  registrar = async (req, res) => {
    const { interaccion, esNueva } = await this.registrarInteraccion.ejecutar(req.docenteId, req.body);
    res.status(esNueva ? 201 : 200).json(interaccion);
  };

  // GET /api/interacciones?sesionId=...
  listar = async (req, res) => {
    const sesionId = typeof req.query.sesionId === "string" ? req.query.sesionId : undefined;
    res.json(await this.listarInteracciones.ejecutar(req.docenteId, sesionId));
  };
}

module.exports = InteraccionController;

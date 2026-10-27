class GeneracionController {
  constructor({ solicitarGeneracion, listarGeneraciones, obtenerGeneracion, cancelarGeneracion }) {
    this.solicitarGeneracion = solicitarGeneracion;
    this.listarGeneraciones = listarGeneraciones;
    this.obtenerGeneracion = obtenerGeneracion;
    this.cancelarGeneracion = cancelarGeneracion;
  }

  // La clave de idempotencia llega en la cabecera Idempotency-Key (o en el cuerpo)
  solicitar = async (req, res) => {
    const clave = req.get("idempotency-key") || (req.body && req.body.claveSolicitud);
    const { generacion, esNueva } = await this.solicitarGeneracion.ejecutar(req.docenteId, clave, req.body);
    res.status(esNueva ? 201 : 200).json(generacion);
  };

  listar = async (req, res) => {
    const estado = typeof req.query.estado === "string" ? req.query.estado : undefined;
    res.json(await this.listarGeneraciones.ejecutar(req.docenteId, { estado }));
  };

  obtenerPorId = async (req, res) => {
    res.json(await this.obtenerGeneracion.ejecutar(req.docenteId, req.params.id));
  };

  // DELETE cancela una generación activa
  eliminar = async (req, res) => {
    await this.cancelarGeneracion.ejecutar(req.docenteId, req.params.id);
    res.status(204).send();
  };
}

module.exports = GeneracionController;

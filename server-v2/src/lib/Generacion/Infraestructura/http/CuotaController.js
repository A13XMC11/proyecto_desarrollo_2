class CuotaController {
  constructor({ consultarCuotas }) {
    this.consultarCuotas = consultarCuotas;
  }

  consultar = async (req, res) => {
    const dia = typeof req.query.dia === "string" ? req.query.dia : undefined;
    res.json(await this.consultarCuotas.ejecutar(req.docenteId, { dia }));
  };
}

module.exports = CuotaController;

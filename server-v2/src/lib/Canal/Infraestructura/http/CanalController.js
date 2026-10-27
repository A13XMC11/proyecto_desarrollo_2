class CanalController {
  constructor({ listarCanales, obtenerCanalPorCodigo }) {
    this.listarCanales = listarCanales;
    this.obtenerCanalPorCodigo = obtenerCanalPorCodigo;
  }

  listar = async (req, res) => {
    const canales = await this.listarCanales.ejecutar();
    res.json(canales);
  };

  obtenerPorCodigo = async (req, res) => {
    res.json(await this.obtenerCanalPorCodigo.ejecutar(req.params.codigo));
  };
}

module.exports = CanalController;

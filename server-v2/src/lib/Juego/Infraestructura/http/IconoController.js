class IconoController {
  constructor({ listarIconos }) {
    this.listarIconos = listarIconos;
  }

  listar = async (req, res) => {
    res.json(await this.listarIconos.ejecutar());
  };
}

module.exports = IconoController;

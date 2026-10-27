const FILTROS = ["cursoId", "estudianteId", "habilidad", "estado", "texto"];

class JuegoController {
  constructor({ crearJuego, listarJuegos, obtenerJuegoPorId, actualizarJuego, archivarJuego, desarchivarJuego }) {
    this.crearJuego = crearJuego;
    this.listarJuegos = listarJuegos;
    this.obtenerJuegoPorId = obtenerJuegoPorId;
    this.actualizarJuego = actualizarJuego;
    this.archivarJuego = archivarJuego;
    this.desarchivarJuego = desarchivarJuego;
  }

  crear = async (req, res) => {
    const juego = await this.crearJuego.ejecutar(req.docenteId, req.body);
    res.status(201).json(juego);
  };

  // Solo se aceptan filtros conocidos y de tipo texto (nunca objetos de la consulta)
  listar = async (req, res) => {
    const filtros = {};
    for (const campo of FILTROS) {
      if (typeof req.query[campo] === "string") filtros[campo] = req.query[campo];
    }
    filtros.incluirArchivados = req.query.incluirArchivados === "true";
    const { pagina, limite } = req.query;
    const resultado = await this.listarJuegos.ejecutar(req.docenteId, filtros, {
      pagina: pagina === undefined ? undefined : Number(pagina),
      limite: limite === undefined ? undefined : Number(limite)
    });
    res.json(resultado);
  };

  obtenerPorId = async (req, res) => {
    res.json(await this.obtenerJuegoPorId.ejecutar(req.docenteId, req.params.id));
  };

  actualizar = async (req, res) => {
    res.json(await this.actualizarJuego.ejecutar(req.docenteId, req.params.id, req.body));
  };

  // DELETE archiva: no hay borrado físico
  eliminar = async (req, res) => {
    await this.archivarJuego.ejecutar(req.docenteId, req.params.id);
    res.status(204).send();
  };

  desarchivar = async (req, res) => {
    res.json(await this.desarchivarJuego.ejecutar(req.docenteId, req.params.id));
  };
}

module.exports = JuegoController;

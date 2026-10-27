const FILTROS = ["cursoId", "estudianteId", "habilidad", "estado", "desde", "hasta"];

class PartidaController {
  constructor({ iniciarPartida, listarPartidas, obtenerPartida, registrarIntento, registrarPista, finalizarPartida, abandonarPartida }) {
    this.iniciarPartida = iniciarPartida;
    this.listarPartidas = listarPartidas;
    this.obtenerPartida = obtenerPartida;
    this.registrarIntento = registrarIntento;
    this.registrarPista = registrarPista;
    this.finalizarPartida = finalizarPartida;
    this.abandonarPartida = abandonarPartida;
  }

  iniciar = async (req, res) => {
    const partida = await this.iniciarPartida.ejecutar(req.docenteId, req.body);
    res.status(201).json(partida);
  };

  // Solo se aceptan filtros conocidos y de tipo texto
  listar = async (req, res) => {
    const filtros = {};
    for (const campo of FILTROS) {
      if (typeof req.query[campo] === "string") filtros[campo] = req.query[campo];
    }
    res.json(await this.listarPartidas.ejecutar(req.docenteId, filtros));
  };

  obtenerPorId = async (req, res) => {
    res.json(await this.obtenerPartida.ejecutar(req.docenteId, req.params.id));
  };

  intento = async (req, res) => {
    res.json(await this.registrarIntento.ejecutar(req.docenteId, req.params.id, req.body));
  };

  pista = async (req, res) => {
    res.json(await this.registrarPista.ejecutar(req.docenteId, req.params.id, req.body));
  };

  finalizar = async (req, res) => {
    res.json(await this.finalizarPartida.ejecutar(req.docenteId, req.params.id));
  };

  // DELETE abandona una partida en curso: el historial no se borra
  eliminar = async (req, res) => {
    await this.abandonarPartida.ejecutar(req.docenteId, req.params.id);
    res.status(204).send();
  };
}

module.exports = PartidaController;

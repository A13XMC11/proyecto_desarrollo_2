const NoEncontrado = require("../../../Compartido/Dominio/Errores/NoEncontrado");

const CANALES = ["aula_computador", "aula_tableta"];

// Lo que un estudiante puede hacer con su sesión. Cada caso de uso es el mismo que usa el docente en el aula;
// aquí el docente, el curso y el estudiante salen de la sesión, nunca de la petición.
class AccesoEstudianteController {
  constructor({ obtenerPerfil, listarJuegosDeEstudiante, listarPartidas, iniciarPartida, obtenerPartida, obtenerPartidaJugable, registrarIntento, registrarPista }) {
    Object.assign(this, { obtenerPerfil, listarJuegosDeEstudiante, listarPartidas, iniciarPartida, obtenerPartida, obtenerPartidaJugable, registrarIntento, registrarPista });
  }

  // También devuelve el token CSRF para recuperarlo tras recargar la página
  yo = async (req, res) => {
    const perfil = await this.obtenerPerfil.ejecutar(req);
    res.set("X-CSRF-Token", req.session.csrf);
    res.json(perfil);
  };

  juegos = async (req, res) => {
    res.json(await this.listarJuegosDeEstudiante.ejecutar(req));
  };

  // Si ya tiene una partida en curso de ese juego, la reanuda en vez de duplicarla
  iniciar = async (req, res) => {
    const { juegoId, canal } = req.body || {};
    try {
      const partida = await this.iniciarPartida.ejecutar(req.docenteId, {
        estudianteId: req.estudianteId,
        juegoId,
        canal: CANALES.includes(canal) ? canal : undefined
      });
      res.status(201).json({ id: partida.id });
    } catch (error) {
      if (error.codigo !== "PARTIDA_EN_CURSO_EXISTENTE") throw error;
      const enCurso = await this.listarPartidas.ejecutar(req.docenteId, { estudianteId: req.estudianteId, estado: "en_curso" });
      const existente = enCurso.find((p) => p.juegoId === juegoId);
      if (!existente) throw error;
      res.json({ id: existente.id });
    }
  };

  // Una partida ajena responde igual que una inexistente
  verificarPropia = async (req, res, next) => {
    const partida = await this.obtenerPartida.ejecutar(req.docenteId, req.params.id);
    if (partida.estudianteId !== req.estudianteId) throw new NoEncontrado("Partida no encontrada");
    next();
  };

  jugable = async (req, res) => res.json(await this.obtenerPartidaJugable.ejecutar(req.docenteId, req.params.id));
  intento = async (req, res) => res.json(await this.registrarIntento.ejecutar(req.docenteId, req.params.id, req.body));
  pista = async (req, res) => res.json(await this.registrarPista.ejecutar(req.docenteId, req.params.id, req.body));
}

module.exports = AccesoEstudianteController;

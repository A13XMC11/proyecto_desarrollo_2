const SesionJuego = require("../Dominio/Entidades/SesionJuego");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

const CANAL_POR_DEFECTO = "aula_computador";

// Una partida se juega siempre sobre la versión aprobada vigente del juego
class IniciarPartida {
  constructor(sesionRepository, juegoRepository, estudianteRepository, canalRepository) {
    this.sesionRepository = sesionRepository;
    this.juegoRepository = juegoRepository;
    this.estudianteRepository = estudianteRepository;
    this.canalRepository = canalRepository;
  }

  async ejecutar(docenteId, { estudianteId, juegoId, canal } = {}) {
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    if (!juego) throw new NoEncontrado("Juego no encontrado");
    if (juego.estado !== "listo" || !juego.versionActualId) {
      throw new ConflictoDeEstado("El juego no tiene una versión aprobada", "JUEGO_SIN_VERSION_APROBADA");
    }

    const estudiante = await this.estudianteRepository.findById(estudianteId, docenteId);
    if (!estudiante) throw new NoEncontrado("Estudiante no encontrado");
    if (estudiante.archivado) throw new ConflictoDeEstado("El estudiante está archivado", "ESTUDIANTE_ARCHIVADO");
    if (estudiante.cursoId !== juego.cursoId) {
      throw new EntradaInvalida("El estudiante no pertenece al curso del juego");
    }
    if (juego.estudianteId && juego.estudianteId !== estudiante.id) {
      throw new EntradaInvalida("El juego está dirigido a otro estudiante");
    }

    const canalEncontrado = await this.canalRepository.findByCodigo(canal || CANAL_POR_DEFECTO);
    if (!canalEncontrado) throw new EntradaInvalida("canal inválido");

    const sesion = new SesionJuego({
      docenteId,
      cursoId: juego.cursoId,
      estudianteId: estudiante.id,
      juegoId: juego.id,
      versionId: juego.versionActualId,
      canalInicioId: canalEncontrado.id,
      semilla: Math.floor(Math.random() * 2147483647)
    });
    return await this.sesionRepository.save(sesion);
  }
}

module.exports = IniciarPartida;

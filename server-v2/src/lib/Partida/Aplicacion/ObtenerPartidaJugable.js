const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const { ejercicioJugable, solucionDe } = require("../Dominio/Entidades/VistaJugable");

const INTENTOS_POR_EJERCICIO = 2;

// Lo que necesita la pantalla del aula para jugar o reanudar una partida, sin respuestas correctas.
// Los ejercicios ya cerrados incluyen su resultado y, si se agotaron los intentos, la solución.
class ObtenerPartidaJugable {
  constructor(sesionRepository, juegoRepository, versionRepository) {
    this.sesionRepository = sesionRepository;
    this.juegoRepository = juegoRepository;
    this.versionRepository = versionRepository;
  }

  async ejecutar(docenteId, id) {
    const sesion = await this.sesionRepository.findById(id, docenteId);
    if (!sesion) throw new NoEncontrado("Partida no encontrada");
    const juego = await this.juegoRepository.findById(sesion.juegoId, docenteId);
    const version = await this.versionRepository.findById(sesion.versionId, sesion.juegoId);
    if (!juego || !version) throw new NoEncontrado("Juego no encontrado");

    const ejercicios = version.ejercicios.map((ejercicio, indice) => {
      const vista = ejercicioJugable(ejercicio, sesion.semilla, indice);
      const intentos = sesion.intentos.filter((i) => i.ejercicioId === ejercicio.id);
      const acertado = intentos.some((i) => i.esCorrecto);
      vista.intentos = intentos.length;
      vista.usoPista = sesion.pistas.some((p) => p.ejercicioId === ejercicio.id);
      vista.acertado = acertado;
      if (!acertado && intentos.length >= INTENTOS_POR_EJERCICIO) vista.solucion = solucionDe(ejercicio);
      return vista;
    });

    return {
      id: sesion.id,
      estado: sesion.estado,
      estudianteId: sesion.estudianteId,
      cursoId: sesion.cursoId,
      juegoId: juego.id,
      titulo: juego.titulo,
      configuracion: version.configuracion,
      ejercicioActual: sesion.ejercicioActual,
      ejercicios
    };
  }
}

module.exports = ObtenerPartidaJugable;

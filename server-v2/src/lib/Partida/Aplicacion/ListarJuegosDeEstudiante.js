// Lo que ve un estudiante al entrar: actividades aprobadas de su curso, dirigidas a todo el curso o a él,
// con la partida que dejó empezada (si hay). Nunca otros estudiantes ni resultados.
class ListarJuegosDeEstudiante {
  constructor(sesionRepository, juegoRepository) {
    this.sesionRepository = sesionRepository;
    this.juegoRepository = juegoRepository;
  }

  async ejecutar({ docenteId, cursoId, estudianteId }) {
    const [pagina, enCurso] = await Promise.all([
      this.juegoRepository.findPaginado(docenteId, { cursoId, estado: "listo" }, { pagina: 1, limite: 50 }),
      this.sesionRepository.findByFiltros(docenteId, { estudianteId, estado: "en_curso" })
    ]);
    const partidaPorJuego = new Map(enCurso.map((p) => [p.juegoId, p.id]));
    return pagina.items
      .filter((j) => !j.estudianteId || j.estudianteId === estudianteId)
      .map((j) => ({ id: j.id, titulo: j.titulo, habilidad: j.habilidad, mecanica: j.mecanica, partidaEnCurso: partidaPorJuego.get(j.id) || null }));
  }
}

module.exports = ListarJuegosDeEstudiante;

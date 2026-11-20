const DIAS_SEMANA = 7;
const RECIENTES = 3;
const PARA_RETOMAR = 5;

// Lo que el docente necesita al entrar (S5-03, §5.2.4): dónde continuar y un panorama corto.
// Una sola petición en lugar de varias desde la página de inicio.
class ObtenerResumenInicio {
  constructor(sesionRepository, juegoRepository, cursoRepository) {
    this.sesionRepository = sesionRepository;
    this.juegoRepository = juegoRepository;
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, ahora = new Date()) {
    const haceUnaSemana = new Date(ahora.getTime() - DIAS_SEMANA * 24 * 60 * 60 * 1000);
    const [cursosActivos, actividades, enCursoTotal, enCurso, terminadasSemana] = await Promise.all([
      this.cursoRepository.contarActivos(docenteId),
      this.juegoRepository.findPaginado(docenteId, {}, { pagina: 1, limite: RECIENTES }),
      this.sesionRepository.contar(docenteId, { estado: "en_curso" }),
      this.sesionRepository.listarEnCurso(docenteId, PARA_RETOMAR),
      this.sesionRepository.contar(docenteId, { estado: "finalizada", desde: haceUnaSemana })
    ]);

    // Títulos de las partidas a medias: una consulta por juego distinto
    const ids = [...new Set(enCurso.map((s) => s.juegoId))];
    const juegos = await Promise.all(ids.map((id) => this.juegoRepository.findById(id, docenteId)));
    const titulos = new Map(juegos.filter(Boolean).map((j) => [j.id, j.titulo]));

    return {
      cursosActivos,
      actividades: { total: actividades.total, recientes: actividades.items },
      enCurso: {
        total: enCursoTotal,
        partidas: enCurso.map((s) => ({
          id: s.id,
          juegoId: s.juegoId,
          titulo: titulos.get(s.juegoId),
          cursoId: s.cursoId,
          estudianteId: s.estudianteId,
          ejercicioActual: s.ejercicioActual,
          iniciadaEn: s.iniciadaEn || s.creadoEn
        }))
      },
      terminadasSemana
    };
  }
}

module.exports = ObtenerResumenInicio;

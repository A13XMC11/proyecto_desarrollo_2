const IndicadoresPartida = require("../Dominio/Entidades/IndicadoresPartida");
const { HABILIDADES } = require("../../Compartido/Dominio/ValoresPermitidos");
const { enumerado, fechaOpcional } = require("../../Compartido/Dominio/Validaciones");

// Resultados del docente por estudiante, curso y habilidad (S5-03, §7.3).
// - Los agregados usan solo partidas finalizadas; las en curso y abandonadas se cuentan aparte.
// - La habilidad sale del juego y los ejercicios disponibles de la versión exacta que se jugó.
// - Nunca llama a la IA y solo ve partidas del propio docente (el repositorio filtra por docenteId).
class ConsultarResultados {
  constructor(sesionRepository, juegoRepository, versionRepository) {
    this.sesionRepository = sesionRepository;
    this.juegoRepository = juegoRepository;
    this.versionRepository = versionRepository;
  }

  async ejecutar(docenteId, { cursoId, estudianteId, habilidad, juegoId, desde, hasta } = {}) {
    if (habilidad !== undefined) enumerado(habilidad, HABILIDADES, "habilidad");
    const sesiones = await this.sesionRepository.findByFiltros(docenteId, {
      cursoId, estudianteId, habilidad, juegoId,
      desde: fechaOpcional(desde, "desde"),
      hasta: fechaOpcional(hasta, "hasta")
    });

    const juegos = await this.cargarJuegos(docenteId, sesiones);
    const versiones = await this.cargarVersiones(sesiones);

    const partidas = sesiones.map((s) => {
      const juego = juegos.get(s.juegoId);
      const version = versiones.get(s.versionId);
      return {
        id: s.id,
        juegoId: s.juegoId,
        titulo: juego ? juego.titulo : undefined,
        habilidad: juego ? juego.habilidad : undefined,
        cursoId: s.cursoId,
        estudianteId: s.estudianteId,
        estado: s.estado,
        ejercicioActual: s.ejercicioActual,
        iniciadaEn: s.iniciadaEn || s.creadoEn,
        finalizadaEn: s.finalizadaEn,
        indicadores: IndicadoresPartida.deSesion(s, version ? version.configuracion.cantidadEjercicios : 0)
      };
    });

    const finalizadas = partidas.filter((p) => p.estado === "finalizada");
    return {
      resumen: {
        partidas: finalizadas.length,
        enCurso: partidas.filter((p) => p.estado === "en_curso").length,
        abandonadas: partidas.filter((p) => p.estado === "abandonada").length,
        ...IndicadoresPartida.sumar(finalizadas.map((p) => p.indicadores))
      },
      porEstudiante: agrupar(finalizadas, "estudianteId"),
      porHabilidad: agrupar(finalizadas.filter((p) => p.habilidad), "habilidad"),
      partidas
    };
  }

  // Una consulta por juego distinto (no por partida)
  async cargarJuegos(docenteId, sesiones) {
    const ids = [...new Set(sesiones.map((s) => s.juegoId))];
    const juegos = await Promise.all(ids.map((id) => this.juegoRepository.findById(id, docenteId)));
    return new Map(juegos.filter(Boolean).map((j) => [j.id, j]));
  }

  async cargarVersiones(sesiones) {
    const pares = new Map(sesiones.map((s) => [s.versionId, s.juegoId]));
    const versiones = await Promise.all([...pares].map(([versionId, juegoId]) => this.versionRepository.findById(versionId, juegoId)));
    return new Map(versiones.filter(Boolean).map((v) => [v.id, v]));
  }
}

function agrupar(partidas, campo) {
  const grupos = new Map();
  for (const p of partidas) {
    if (!grupos.has(p[campo])) grupos.set(p[campo], []);
    grupos.get(p[campo]).push(p.indicadores);
  }
  return [...grupos].map(([clave, lista]) => ({ [campo]: clave, partidas: lista.length, ...IndicadoresPartida.sumar(lista) }));
}

module.exports = ConsultarResultados;

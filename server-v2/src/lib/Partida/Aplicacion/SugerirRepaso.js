const AnalisisRepaso = require("../Dominio/Entidades/AnalisisRepaso");
const { HABILIDADES } = require("../../Compartido/Dominio/ValoresPermitidos");
const { enumerado, fechaOpcional } = require("../../Compartido/Dominio/Validaciones");
const { cargarJuegos, cargarVersiones } = require("./cargarJuegosYVersiones");

// Qué conviene repasar, según las partidas finalizadas del docente (sin IA, solo cifras).
// Acepta los mismos filtros que los resultados: así el botón analiza lo que el docente tiene a la vista.
class SugerirRepaso {
  constructor(sesionRepository, juegoRepository, versionRepository) {
    this.sesionRepository = sesionRepository;
    this.juegoRepository = juegoRepository;
    this.versionRepository = versionRepository;
  }

  async ejecutar(docenteId, { cursoId, estudianteId, habilidad, juegoId, desde, hasta } = {}) {
    if (habilidad !== undefined) enumerado(habilidad, HABILIDADES, "habilidad");
    const sesiones = await this.sesionRepository.findByFiltros(docenteId, {
      cursoId, estudianteId, habilidad, juegoId, estado: "finalizada",
      desde: fechaOpcional(desde, "desde"),
      hasta: fechaOpcional(hasta, "hasta")
    });

    const juegos = await cargarJuegos(this.juegoRepository, docenteId, sesiones);
    const versiones = await cargarVersiones(this.versionRepository, sesiones);

    // Sin juego o sin versión no se sabe qué habilidad ni qué ejercicio se jugó: esa partida no se puede analizar
    const partidas = sesiones.flatMap((s) => {
      const juego = juegos.get(s.juegoId);
      const version = versiones.get(s.versionId);
      if (!juego || !juego.habilidad || !version) return [];
      return [{ habilidad: juego.habilidad, estudianteId: s.estudianteId, ejercicios: version.ejercicios, intentos: s.intentos, pistas: s.pistas }];
    });

    return { partidas: partidas.length, ...AnalisisRepaso.analizar(partidas) };
  }
}

module.exports = SugerirRepaso;

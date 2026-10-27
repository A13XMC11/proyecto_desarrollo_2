const Juego = require("../Dominio/Entidades/Juego");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const { COMPATIBILIDAD } = require("../../Compartido/Dominio/ValoresPermitidos");

// Crea el juego (documento Mongo) tras comprobar en la base relacional que el curso y el
// estudiante existen y son del docente: no hay clave foránea entre los dos motores.
class CrearJuego {
  constructor(juegoRepository, cursoRepository, estudianteRepository) {
    this.juegoRepository = juegoRepository;
    this.cursoRepository = cursoRepository;
    this.estudianteRepository = estudianteRepository;
  }

  async ejecutar(docenteId, { cursoId, estudianteId, titulo, habilidad } = {}) {
    const curso = await this.cursoRepository.findById(cursoId, docenteId);
    if (!curso) throw new NoEncontrado("Curso no encontrado");

    if (estudianteId) {
      const estudiante = await this.estudianteRepository.findById(estudianteId, docenteId);
      if (!estudiante) throw new NoEncontrado("Estudiante no encontrado");
      if (estudiante.cursoId !== curso.id) throw new EntradaInvalida("El estudiante no pertenece al curso");
    }

    const juego = new Juego({
      docenteId, cursoId, estudianteId, titulo, habilidad,
      mecanica: COMPATIBILIDAD[habilidad],
      origen: "manual"
    });
    return await this.juegoRepository.save(juego);
  }
}

module.exports = CrearJuego;

const Estudiante = require("../Dominio/Entidades/Estudiante");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class CrearEstudiante {
  constructor(estudianteRepository, cursoRepository) {
    this.estudianteRepository = estudianteRepository;
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, data = {}) {
    const curso = await this.cursoRepository.findById(data.cursoId, docenteId);
    if (!curso) throw new NoEncontrado("Curso no encontrado");

    const estudiante = new Estudiante({ ...data, cursoId: curso.id });
    return await this.estudianteRepository.save(estudiante);
  }
}

module.exports = CrearEstudiante;

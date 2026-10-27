const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ListarEstudiantes {
  constructor(estudianteRepository, cursoRepository) {
    this.estudianteRepository = estudianteRepository;
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, cursoId, filtros) {
    const curso = await this.cursoRepository.findById(cursoId, docenteId);
    if (!curso) throw new NoEncontrado("Curso no encontrado");
    return await this.estudianteRepository.findByCurso(cursoId, docenteId, filtros);
  }
}

module.exports = ListarEstudiantes;

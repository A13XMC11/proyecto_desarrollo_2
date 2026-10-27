const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ObtenerCursoPorId {
  constructor(cursoRepository) {
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, id) {
    const curso = await this.cursoRepository.findById(id, docenteId);
    if (!curso) throw new NoEncontrado("Curso no encontrado");
    return curso;
  }
}

module.exports = ObtenerCursoPorId;

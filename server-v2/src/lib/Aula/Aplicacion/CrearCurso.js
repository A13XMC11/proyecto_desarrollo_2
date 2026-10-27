const Curso = require("../Dominio/Entidades/Curso");

class CrearCurso {
  constructor(cursoRepository) {
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, data = {}) {
    const curso = new Curso({ ...data, docenteId });
    return await this.cursoRepository.save(curso);
  }
}

module.exports = CrearCurso;

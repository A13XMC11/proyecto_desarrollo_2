const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

// No hay borrado físico: eliminar un curso es archivarlo (los estudiantes y juegos lo referencian)
class ArchivarCurso {
  constructor(cursoRepository) {
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, id) {
    const archivado = await this.cursoRepository.update(id, docenteId, { archivado: true });
    if (!archivado) throw new NoEncontrado("Curso no encontrado");
    return archivado;
  }
}

module.exports = ArchivarCurso;

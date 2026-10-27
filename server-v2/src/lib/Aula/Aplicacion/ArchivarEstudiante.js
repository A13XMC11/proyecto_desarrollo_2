const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

// No hay borrado físico: eliminar un estudiante es archivarlo (conserva su historial de partidas)
class ArchivarEstudiante {
  constructor(estudianteRepository) {
    this.estudianteRepository = estudianteRepository;
  }

  async ejecutar(docenteId, id) {
    const archivado = await this.estudianteRepository.update(id, docenteId, { archivado: true });
    if (!archivado) throw new NoEncontrado("Estudiante no encontrado");
    return archivado;
  }
}

module.exports = ArchivarEstudiante;

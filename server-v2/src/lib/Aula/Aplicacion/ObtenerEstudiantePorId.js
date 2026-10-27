const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ObtenerEstudiantePorId {
  constructor(estudianteRepository) {
    this.estudianteRepository = estudianteRepository;
  }

  async ejecutar(docenteId, id) {
    const estudiante = await this.estudianteRepository.findById(id, docenteId);
    if (!estudiante) throw new NoEncontrado("Estudiante no encontrado");
    return estudiante;
  }
}

module.exports = ObtenerEstudiantePorId;

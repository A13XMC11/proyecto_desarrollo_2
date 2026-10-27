const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class ObtenerDocentePorId {
  constructor(docenteRepository) {
    this.docenteRepository = docenteRepository;
  }

  // Un docente solo consulta su propia cuenta: el correo no es visible para otros
  async ejecutar(docenteId, id) {
    const docente = docenteId === id ? await this.docenteRepository.findById(id) : null;
    if (!docente) throw new NoEncontrado("Docente no encontrado");
    return docente.aPublico();
  }
}

module.exports = ObtenerDocentePorId;

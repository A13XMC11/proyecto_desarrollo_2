const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

class EliminarDocente {
  constructor(docenteRepository) {
    this.docenteRepository = docenteRepository;
  }

  // Un docente solo puede eliminar su propia cuenta, y solo si no tiene datos asociados
  async ejecutar(docenteId, id) {
    const eliminado = docenteId === id ? await this.docenteRepository.eliminar(id) : false;
    if (!eliminado) throw new NoEncontrado("Docente no encontrado");
  }
}

module.exports = EliminarDocente;

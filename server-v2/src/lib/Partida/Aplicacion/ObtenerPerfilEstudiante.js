const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");

// Solo lo necesario para saludar: el estudiante de la sesión, si sigue activo
class ObtenerPerfilEstudiante {
  constructor(estudianteRepository) {
    this.estudianteRepository = estudianteRepository;
  }

  async ejecutar({ docenteId, estudianteId }) {
    const e = await this.estudianteRepository.findById(estudianteId, docenteId);
    if (!e || e.archivado) throw new NoEncontrado("Estudiante no encontrado");
    return { apodo: e.apodo || null, avatarId: e.avatarId, codigoLista: e.codigoLista };
  }
}

module.exports = ObtenerPerfilEstudiante;

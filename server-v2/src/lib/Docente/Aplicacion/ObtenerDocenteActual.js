const NoAutenticado = require("../../Compartido/Dominio/Errores/NoAutenticado");

// El docente de la sesión actual. Si la cuenta ya no existe, la sesión no vale.
class ObtenerDocenteActual {
  constructor(docenteRepository) {
    this.docenteRepository = docenteRepository;
  }

  async ejecutar(docenteId) {
    const docente = await this.docenteRepository.findById(docenteId);
    if (!docente) throw new NoAutenticado("Inicia sesión para continuar", "SESION_REQUERIDA");
    return docente.aPublico();
  }
}

module.exports = ObtenerDocenteActual;

class ListarDocentes {
  constructor(docenteRepository) {
    this.docenteRepository = docenteRepository;
  }

  // Mientras no existan roles, el listado solo contiene la cuenta del propio docente (resumen sin correo):
  // listar a todos permitiría enumerar identificadores y datos de otras cuentas.
  async ejecutar(docenteId) {
    const docente = await this.docenteRepository.findById(docenteId);
    return docente ? [{ id: docente.id, nombre: docente.nombre, institucion: docente.institucion }] : [];
  }
}

module.exports = ListarDocentes;

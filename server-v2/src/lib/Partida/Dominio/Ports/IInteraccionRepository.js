class IInteraccionRepository {
  async registrar(interaccion) {}
  async findBySesion(sesionId, docenteId) {}
}

module.exports = IInteraccionRepository;

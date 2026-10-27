class ICuotaRepository {
  // docenteId undefined/null = contador global
  async obtener(docenteId, periodo) {}
  async reservar({ docenteId, periodo, cantidad, limite }) {}
  async liberar({ cuotaId, cantidad }) {}
  async consumir({ cuotaId, cantidad, real }) {}
}

module.exports = ICuotaRepository;

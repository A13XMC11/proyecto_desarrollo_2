class ListarCanales {
  constructor(canalRepository) {
    this.canalRepository = canalRepository;
  }

  async ejecutar() {
    return await this.canalRepository.findAll();
  }
}

module.exports = ListarCanales;

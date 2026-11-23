// Los iconos que el docente puede poner o cambiar en una actividad de temática libre (lista cerrada, solo lectura)
class ListarIconos {
  constructor(emojisPermitidos) {
    this.emojisPermitidos = emojisPermitidos;
  }

  async ejecutar() {
    return { categorias: this.emojisPermitidos.categorias() };
  }
}

module.exports = ListarIconos;

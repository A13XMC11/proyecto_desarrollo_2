const Juego = require("../Dominio/Entidades/Juego");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const { fusionarCambios } = require("../../Compartido/Dominio/Validaciones");

// Del juego solo se edita el título; el contenido cambia creando una nueva versión
class ActualizarJuego {
  constructor(juegoRepository) {
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, id, cambios) {
    const actual = await this.juegoRepository.findById(id, docenteId);
    if (!actual) throw new NoEncontrado("Juego no encontrado");

    const { datos, escritura } = fusionarCambios(actual, cambios, ["titulo"]);
    const validado = new Juego(datos);
    if ("titulo" in escritura) escritura.titulo = validado.titulo;
    const actualizado = await this.juegoRepository.update(id, docenteId, escritura);
    if (!actualizado) throw new NoEncontrado("Juego no encontrado");
    return actualizado;
  }
}

module.exports = ActualizarJuego;

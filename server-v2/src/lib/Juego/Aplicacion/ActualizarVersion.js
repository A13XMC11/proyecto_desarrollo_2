const VersionJuego = require("../Dominio/Entidades/VersionJuego");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

// Solo se editan los ejercicios, y solo mientras la versión sea un borrador
class ActualizarVersion {
  constructor(versionRepository, juegoRepository) {
    this.versionRepository = versionRepository;
    this.juegoRepository = juegoRepository;
  }

  async ejecutar(docenteId, juegoId, id, { ejercicios } = {}) {
    // Sin esto, un cuerpo vacío o con un campo mal escrito reemplazaría los ejercicios por una lista vacía
    if (!Array.isArray(ejercicios)) throw new EntradaInvalida("ejercicios requeridos (lista)");
    const juego = await this.juegoRepository.findById(juegoId, docenteId);
    const actual = juego ? await this.versionRepository.findById(id, juego.id) : null;
    if (!actual) throw new NoEncontrado("Versión no encontrada");
    if (actual.estado !== "borrador") {
      throw new ConflictoDeEstado("Solo se puede editar un borrador", "VERSION_NO_EDITABLE");
    }

    const validada = new VersionJuego({ ...actual, ejercicios });
    const actualizada = await this.versionRepository.actualizarBorrador(id, juego.id, { ejercicios: validada.ejercicios });
    if (!actualizada) throw new ConflictoDeEstado("Solo se puede editar un borrador", "VERSION_NO_EDITABLE");
    return actualizada;
  }
}

module.exports = ActualizarVersion;

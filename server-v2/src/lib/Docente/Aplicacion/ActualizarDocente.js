const Docente = require("../Dominio/Entidades/Docente");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const { fusionarCambios } = require("../../Compartido/Dominio/Validaciones");

const CAMPOS = ["nombre", "institucion"];

class ActualizarDocente {
  constructor(docenteRepository) {
    this.docenteRepository = docenteRepository;
  }

  // Un docente solo puede editar su propia cuenta
  async ejecutar(docenteId, id, cambios) {
    const actual = docenteId === id ? await this.docenteRepository.findById(id) : null;
    if (!actual) throw new NoEncontrado("Docente no encontrado");

    const { datos, escritura } = fusionarCambios(actual, cambios, CAMPOS);
    new Docente(datos);
    const actualizado = await this.docenteRepository.update(id, escritura);
    if (!actualizado) throw new NoEncontrado("Docente no encontrado");
    return actualizado.aPublico();
  }
}

module.exports = ActualizarDocente;

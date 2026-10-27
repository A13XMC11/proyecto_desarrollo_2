const Estudiante = require("../Dominio/Entidades/Estudiante");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const { fusionarCambios } = require("../../Compartido/Dominio/Validaciones");

// El curso no se puede cambiar
const CAMPOS = ["codigoLista", "apodo", "franjaEdad", "avatarId", "intereses", "archivado"];

class ActualizarEstudiante {
  constructor(estudianteRepository) {
    this.estudianteRepository = estudianteRepository;
  }

  async ejecutar(docenteId, id, cambios) {
    const actual = await this.estudianteRepository.findById(id, docenteId);
    if (!actual) throw new NoEncontrado("Estudiante no encontrado");

    for (const campo of ["intereses", "archivado", "franjaEdad", "codigoLista", "avatarId"]) {
      if (cambios && cambios[campo] === null) throw new EntradaInvalida(`${campo} no admite null`);
    }

    const { datos, escritura } = fusionarCambios(actual, cambios, CAMPOS);
    const validado = new Estudiante(datos);
    for (const campo of Object.keys(escritura)) {
      if (escritura[campo] !== null) escritura[campo] = validado[campo];
    }
    const actualizado = await this.estudianteRepository.update(id, docenteId, escritura);
    if (!actualizado) throw new NoEncontrado("Estudiante no encontrado");
    return actualizado;
  }
}

module.exports = ActualizarEstudiante;

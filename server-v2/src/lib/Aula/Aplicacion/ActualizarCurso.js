const Curso = require("../Dominio/Entidades/Curso");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const { fusionarCambios } = require("../../Compartido/Dominio/Validaciones");

const CAMPOS = ["grado", "paralelo", "anioLectivo", "archivado"];

class ActualizarCurso {
  constructor(cursoRepository) {
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, id, cambios) {
    const actual = await this.cursoRepository.findById(id, docenteId);
    if (!actual) throw new NoEncontrado("Curso no encontrado");

    const { datos, escritura } = fusionarCambios(actual, cambios, CAMPOS);
    const validado = new Curso(datos);
    // Se escribe el valor ya normalizado por la entidad (por ejemplo el paralelo en mayúscula)
    for (const campo of Object.keys(escritura)) escritura[campo] = validado[campo];
    const actualizado = await this.cursoRepository.update(id, docenteId, escritura);
    if (!actualizado) throw new NoEncontrado("Curso no encontrado");
    return actualizado;
  }
}

module.exports = ActualizarCurso;

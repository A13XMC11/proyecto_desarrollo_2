const NoAutenticado = require("../../Compartido/Dominio/Errores/NoAutenticado");
const { normalizarCodigo } = require("./CodigoAcceso");

// Un estudiante entra con el código del curso y su código de lista (sin cuenta ni contraseña).
// Cualquier fallo da el mismo mensaje: no revela si el código del curso existe.
class IngresarEstudiante {
  constructor(cursoRepository, estudianteRepository) {
    this.cursoRepository = cursoRepository;
    this.estudianteRepository = estudianteRepository;
  }

  async ejecutar({ codigoAcceso, codigoLista } = {}) {
    const rechazo = () => new NoAutenticado("El código del curso o tu número no es correcto", "ACCESO_INVALIDO");
    const curso = await this.cursoRepository.findByCodigoAcceso(normalizarCodigo(codigoAcceso));
    if (!curso) throw rechazo();

    const lista = normalizarCodigo(codigoLista);
    const estudiantes = await this.estudianteRepository.findByCurso(curso.id, curso.docenteId, { archivado: false });
    const estudiante = estudiantes.find((e) => e.codigoLista === lista);
    if (!estudiante) throw rechazo();

    return { docenteId: curso.docenteId, cursoId: curso.id, estudiante };
  }
}

module.exports = IngresarEstudiante;

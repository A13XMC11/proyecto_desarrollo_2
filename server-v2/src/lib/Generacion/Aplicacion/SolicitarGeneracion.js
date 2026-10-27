const Generacion = require("../Dominio/Entidades/Generacion");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

const CANAL_POR_DEFECTO = "docente_computador";

// Registra la solicitud de generación (estado "pendiente"). Es idempotente por (docente, claveSolicitud):
// repetir la misma clave devuelve la solicitud original con esNueva = false.
// La llamada al proveedor de IA y el control de cupos se conectan en el sprint de generación.
class SolicitarGeneracion {
  constructor(generacionRepository, cursoRepository, estudianteRepository, canalRepository) {
    this.generacionRepository = generacionRepository;
    this.cursoRepository = cursoRepository;
    this.estudianteRepository = estudianteRepository;
    this.canalRepository = canalRepository;
  }

  async ejecutar(docenteId, claveSolicitud, data = {}) {
    const curso = await this.cursoRepository.findById(data.cursoId, docenteId);
    if (!curso) throw new NoEncontrado("Curso no encontrado");

    if (data.estudianteId) {
      const estudiante = await this.estudianteRepository.findById(data.estudianteId, docenteId);
      if (!estudiante) throw new NoEncontrado("Estudiante no encontrado");
      if (estudiante.cursoId !== curso.id) throw new EntradaInvalida("El estudiante no pertenece al curso");
    }

    const canal = await this.canalRepository.findByCodigo(data.canal || CANAL_POR_DEFECTO);
    if (!canal) throw new EntradaInvalida("canal inválido");

    const generacion = new Generacion({
      docenteId,
      canalId: canal.id,
      claveSolicitud,
      parametros: {
        cursoId: curso.id,
        estudianteId: data.estudianteId,
        habilidad: data.habilidad,
        tematica: data.tematica,
        cantidad: data.cantidad,
        instruccion: data.instruccion
      }
    });
    return await this.generacionRepository.save(generacion);
  }
}

module.exports = SolicitarGeneracion;

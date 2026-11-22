const Generacion = require("../Dominio/Entidades/Generacion");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const ServicioNoDisponible = require("../../Compartido/Dominio/Errores/ServicioNoDisponible");

const CANAL_POR_DEFECTO = "docente_computador";

const mismosParametros = (a, b) =>
  ["cursoId", "estudianteId", "habilidad", "tematica", "cantidad", "instruccion"].every((campo) => a[campo] === b[campo]);

// Pide una actividad con IA (RF-019, RF-023, RF-024). Pasos 1 a 4 del flujo; la llamada al generador
// y el guardado los hace ProcesarGeneracion. Idempotente por (docente, claveSolicitud): repetir la misma
// clave devuelve la generación original (esNueva = false) sin gastar cupo; la misma clave con otros
// parámetros es un conflicto.
//
// Si la solicitud se rechaza antes de llamar al proveedor (apagada, otra en curso, sin cupo) la generación
// queda "fallida" con su código, la reserva se libera y el rechazo se informa como error.
class SolicitarGeneracion {
  constructor({ generacionRepository, cursoRepository, estudianteRepository, canalRepository, config, reservarCupo, liberarReserva, procesarGeneracion, conciliar }) {
    Object.assign(this, { generacionRepository, cursoRepository, estudianteRepository, canalRepository, config, reservarCupo, liberarReserva, procesarGeneracion, conciliar });
  }

  async ejecutar(docenteId, claveSolicitud, data = {}) {
    const generacion = await this.armar(docenteId, claveSolicitud, data);
    const { generacion: guardada, esNueva } = await this.generacionRepository.save(generacion);

    if (!esNueva) {
      if (!mismosParametros(guardada.parametros, generacion.parametros)) {
        throw new ConflictoDeEstado("Esa clave de solicitud ya se usó con otros datos", "CLAVE_REUTILIZADA");
      }
      await this.conciliar.ejecutar({ docenteId });
      return { generacion: await this.generacionRepository.findById(guardada.id, docenteId), esNueva: false };
    }

    if (!this.config.habilitada) {
      throw await this.rechazar(guardada, "GENERACION_DESHABILITADA",
        new ServicioNoDisponible("La creación con IA todavía no está habilitada. Puedes crear la actividad a mano.", "GENERACION_DESHABILITADA"));
    }

    // Una generación del docente que quedó colgada no debe bloquearle las nuevas: se concilia antes de reservar
    await this.conciliar.ejecutar({ docenteId })
      .catch((error) => console.error("No se pudo conciliar las generaciones:", error));

    let reservada;
    try {
      reservada = await this.reservarCupo.ejecutar(guardada);
    } catch (error) {
      throw await this.rechazar(guardada, error.codigo || "ERROR_AL_RESERVAR", error);
    }

    const procesando = await this.generacionRepository.marcarProcesando(reservada.id, docenteId);
    if (!procesando) {
      // La canceló el docente antes de empezar: no hubo llamada, la reserva vuelve
      await this.liberarReserva.ejecutar(reservada);
      return { generacion: await this.generacionRepository.findById(reservada.id, docenteId), esNueva: true };
    }
    return { generacion: await this.procesarGeneracion.ejecutar(procesando), esNueva: true };
  }

  // Pasos 1 y 2: propiedad, estado de curso y estudiante, y parámetros válidos
  async armar(docenteId, claveSolicitud, data) {
    const curso = await this.cursoRepository.findById(data.cursoId, docenteId);
    if (!curso) throw new NoEncontrado("Curso no encontrado");
    if (curso.archivado) throw new ConflictoDeEstado("El curso está archivado", "CURSO_ARCHIVADO");

    if (data.estudianteId) {
      const estudiante = await this.estudianteRepository.findById(data.estudianteId, docenteId);
      if (!estudiante) throw new NoEncontrado("Estudiante no encontrado");
      if (estudiante.cursoId !== curso.id) throw new EntradaInvalida("El estudiante no pertenece al curso");
      if (estudiante.archivado) throw new ConflictoDeEstado("El estudiante está archivado", "ESTUDIANTE_ARCHIVADO");
    }
    const canal = await this.canalRepository.findByCodigo(data.canal || CANAL_POR_DEFECTO);
    if (!canal) throw new EntradaInvalida("canal inválido");
    if (data.cantidad === 10 && !this.config.permitirDiez) throw new EntradaInvalida("La cantidad de 10 ejercicios no está habilitada");

    return new Generacion({
      docenteId, canalId: canal.id, claveSolicitud,
      parametros: {
        cursoId: curso.id, estudianteId: data.estudianteId, habilidad: data.habilidad,
        tematica: data.tematica, cantidad: data.cantidad, instruccion: data.instruccion
      }
    });
  }

  // Cierra como fallida una generación rechazada antes de llamar al proveedor y devuelve el error a lanzar
  async rechazar(generacion, codigo, error) {
    const fallida = await this.generacionRepository.marcarFallida(generacion.id, generacion.docenteId, codigo);
    await this.liberarReserva.ejecutar(fallida || generacion);
    return error;
  }
}

module.exports = SolicitarGeneracion;

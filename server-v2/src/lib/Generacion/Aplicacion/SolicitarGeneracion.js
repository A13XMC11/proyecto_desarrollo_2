const Generacion = require("../Dominio/Entidades/Generacion");
const { periodoDiario, periodoMensual } = require("../Dominio/Entidades/Periodo");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const LimiteAlcanzado = require("../../Compartido/Dominio/Errores/LimiteAlcanzado");

const CANAL_POR_DEFECTO = "docente_computador";
const CUPO_POR_GENERACION = 1;
const MAXIMO_ACTIVAS_POR_DOCENTE = 1;

// Pasos 1 a 4 del flujo técnico (§13): propiedad del curso/estudiante, validación, idempotencia por
// (docente, claveSolicitud), generación habilitada, una activa por docente y reserva atómica de cupo
// (diario del docente y global del mes) antes de llamar al proveedor. Responde enseguida con la
// generación "pendiente" y deja el procesamiento en segundo plano.
class SolicitarGeneracion {
  constructor(
    { generacionRepository, cuotaRepository, cursoRepository, estudianteRepository, canalRepository, procesarGeneracion, conciliarGeneraciones },
    { habilitada = false, permitirDiez = false, limiteDiario = 3, limiteGlobalMensual = 100, zonaHoraria = "America/Guayaquil", alFallarProceso = () => {} } = {}
  ) {
    this.generacionRepository = generacionRepository;
    this.cuotaRepository = cuotaRepository;
    this.cursoRepository = cursoRepository;
    this.estudianteRepository = estudianteRepository;
    this.canalRepository = canalRepository;
    this.procesarGeneracion = procesarGeneracion;
    this.conciliarGeneraciones = conciliarGeneraciones;
    this.config = { habilitada, permitirDiez, limiteDiario, limiteGlobalMensual, zonaHoraria };
    this.alFallarProceso = alFallarProceso;
  }

  async ejecutar(docenteId, claveSolicitud, data = {}) {
    // Reenviar la misma solicitud devuelve la original (doble clic, red lenta)
    if (typeof claveSolicitud === "string") {
      const existente = await this.generacionRepository.findByClave(docenteId, claveSolicitud);
      if (existente) return { generacion: existente, esNueva: false };
    }

    const curso = await this.cursoRepository.findById(data.cursoId, docenteId);
    if (!curso) throw new NoEncontrado("Curso no encontrado");
    if (curso.archivado) throw new EntradaInvalida("El curso está archivado");

    if (data.estudianteId) {
      const estudiante = await this.estudianteRepository.findById(data.estudianteId, docenteId);
      if (!estudiante) throw new NoEncontrado("Estudiante no encontrado");
      if (estudiante.cursoId !== curso.id) throw new EntradaInvalida("El estudiante no pertenece al curso");
      if (estudiante.archivado) throw new EntradaInvalida("El estudiante está archivado");
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
    if (generacion.parametros.cantidad === 10 && !this.config.permitirDiez) {
      throw new EntradaInvalida("la cantidad de 10 ejercicios no está habilitada");
    }

    // Una generación deshabilitada se trata como cupo cero (§7.4.1)
    if (!this.config.habilitada) {
      throw new LimiteAlcanzado("La generación con IA está deshabilitada", "GENERACION_DESHABILITADA");
    }

    // Las que quedaron colgadas (reinicio del servidor) no deben bloquear al docente
    await this.conciliarGeneraciones.deDocente(docenteId);
    if ((await this.generacionRepository.contarActivas(docenteId)) >= MAXIMO_ACTIVAS_POR_DOCENTE) {
      throw new LimiteAlcanzado("Ya tienes una actividad generándose. Espera a que termine.", "GENERACION_EN_CURSO");
    }

    const reserva = await this.reservarCupo(docenteId);
    let resultado;
    try {
      resultado = await this.generacionRepository.save(generacion);
    } catch (error) {
      await this.devolverCupo(reserva);
      throw error;
    }
    if (!resultado.esNueva) {
      // Otra petición con la misma clave ganó la carrera: esta reserva sobra
      await this.devolverCupo(reserva);
      return resultado;
    }

    const conReserva = await this.generacionRepository.registrarReserva(resultado.generacion.id, docenteId, reserva);
    if (!conReserva) {
      await this.devolverCupo(reserva);
      return resultado;
    }

    // Segundo plano: la respuesta no espera a la IA; el docente consulta el estado por el id
    this.procesarGeneracion.ejecutar(conReserva.id, docenteId).catch((error) => this.alFallarProceso(error, conReserva));
    return { generacion: conReserva, esNueva: true };
  }

  // Atómica en cada contador (UPDATE condicional): con peticiones concurrentes no se supera ningún límite
  async reservarCupo(docenteId) {
    const ahora = new Date();
    const { limiteDiario, limiteGlobalMensual, zonaHoraria } = this.config;

    const diaria = await this.cuotaRepository.reservar({
      docenteId, periodo: periodoDiario(ahora, zonaHoraria), cantidad: CUPO_POR_GENERACION, limite: limiteDiario
    });
    if (!diaria.reservada) {
      throw new LimiteAlcanzado(`Ya usaste tus ${limiteDiario} generaciones de hoy. Mañana tendrás cupo nuevo.`, "CUPO_DIARIO_AGOTADO");
    }

    const global = await this.cuotaRepository.reservar({
      docenteId: undefined, periodo: periodoMensual(ahora, zonaHoraria), cantidad: CUPO_POR_GENERACION, limite: limiteGlobalMensual
    });
    if (!global.reservada) {
      await this.cuotaRepository.liberar({ cuotaId: diaria.cuota.id, cantidad: CUPO_POR_GENERACION });
      throw new LimiteAlcanzado("Se alcanzó el presupuesto de generación de este mes.", "CUPO_GLOBAL_AGOTADO");
    }

    return {
      cuotaDiariaId: diaria.cuota.id,
      cupoDiario: CUPO_POR_GENERACION,
      cuotaGlobalId: global.cuota.id,
      montoGlobal: CUPO_POR_GENERACION
    };
  }

  async devolverCupo(reserva) {
    await this.cuotaRepository.liberar({ cuotaId: reserva.cuotaDiariaId, cantidad: reserva.cupoDiario });
    await this.cuotaRepository.liberar({ cuotaId: reserva.cuotaGlobalId, cantidad: reserva.montoGlobal });
  }
}

module.exports = SolicitarGeneracion;

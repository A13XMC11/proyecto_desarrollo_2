const LimiteAlcanzado = require("../../Compartido/Dominio/Errores/LimiteAlcanzado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const { periodoDiario, periodoMensual } = require("../Dominio/Entidades/Periodo");

// Reserva el cupo de una generación ANTES de llamar al proveedor (RF-024, RNF-012):
// una generación activa por docente, el cupo diario del docente y el costo máximo de una llamada
// contra el presupuesto global del mes. Cada reserva es atómica en la base; si una falla se
// devuelven las anteriores. Devuelve la generación con su reserva registrada.
class ReservarCupoGeneracion {
  constructor(generacionRepository, cuotaRepository, config) {
    this.generacionRepository = generacionRepository;
    this.cuotaRepository = cuotaRepository;
    this.config = config;
  }

  async ejecutar(generacion, ahora = new Date()) {
    await this.comprobarSimultaneas(generacion);

    // Lo ya reservado se devuelve ante cualquier fallo, también una excepción (corte de base de datos):
    // sin registro de reserva en la generación, nada más podría recuperarlo.
    const hechas = [];
    try {
      const diaria = await this.cuotaRepository.reservar({
        docenteId: generacion.docenteId, periodo: periodoDiario(ahora, this.config.zonaHoraria), cantidad: 1, limite: this.config.maxDiarias
      });
      if (!diaria.reservada) {
        throw new LimiteAlcanzado("Ya usaste todas las actividades con IA de hoy. Mañana tendrás cupo de nuevo.", "CUPO_DIARIO_AGOTADO");
      }
      hechas.push({ cuotaId: diaria.cuota.id, cantidad: 1 });

      const global = await this.cuotaRepository.reservar({
        periodo: periodoMensual(ahora, this.config.zonaHoraria), cantidad: this.config.costoMaximoLlamada, limite: this.config.presupuestoMensual
      });
      if (!global.reservada) {
        // No se expone el presupuesto global: es un dato de administración
        throw new LimiteAlcanzado("La creación con IA no está disponible por ahora. Puedes crear la actividad a mano.", "PRESUPUESTO_AGOTADO");
      }
      hechas.push({ cuotaId: global.cuota.id, cantidad: this.config.costoMaximoLlamada });

      const registrada = await this.generacionRepository.registrarReserva(generacion.id, generacion.docenteId, {
        cuotaDiariaId: diaria.cuota.id, cupoDiario: 1,
        cuotaGlobalId: global.cuota.id, montoGlobal: this.config.costoMaximoLlamada
      });
      // La generación dejó de estar activa (p. ej. la canceló el docente) mientras se reservaba
      if (!registrada) throw new ConflictoDeEstado("La solicitud ya no está activa", "GENERACION_NO_ACTIVA");
      return registrada;
    } catch (error) {
      await this.devolver(hechas);
      throw error;
    }
  }

  async devolver(hechas) {
    for (const reserva of hechas) {
      await this.cuotaRepository.liberar(reserva)
        .catch((e) => console.error("No se pudo devolver una reserva de cupo", reserva.cuotaId, e));
    }
  }

  // Solo la generación activa más antigua del docente puede seguir. Dos solicitudes simultáneas no pasan
  // ambas; en una carrera muy estrecha podrían pasar dos, pero el cupo diario y el presupuesto, que sí
  // son atómicos, acotan igualmente el gasto.
  async comprobarSimultaneas(generacion) {
    const activas = await this.generacionRepository.findActivas(generacion.docenteId);
    const posicion = activas.findIndex((g) => g.id === generacion.id);
    if (posicion < 0) throw new ConflictoDeEstado("La solicitud ya no está activa", "GENERACION_NO_ACTIVA");
    if (posicion >= this.config.maxSimultaneas) {
      throw new LimiteAlcanzado("Ya tienes una actividad generándose. Espera a que termine para pedir otra.", "GENERACION_EN_CURSO");
    }
  }
}

module.exports = ReservarCupoGeneracion;

const RecomendacionRepaso = require("../Dominio/Entidades/RecomendacionRepaso");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const ErrorDelGenerador = require("../../Compartido/Dominio/Errores/ErrorDelGenerador");
const LimiteAlcanzado = require("../../Compartido/Dominio/Errores/LimiteAlcanzado");
const ServicioNoDisponible = require("../../Compartido/Dominio/Errores/ServicioNoDisponible");
const { periodoMensual } = require("../../Generacion/Dominio/Entidades/Periodo");

// Recomendación de repaso redactada por la IA (segunda capa de "¿Qué repasar?"). La IA solo recibe el análisis
// que calcula el servidor (cifras agregadas, sin identificadores) y devuelve texto plano que se valida.
// Cupo y presupuesto, como en la generación:
//  - el docente tiene un límite mensual de recomendaciones (contador propio, sin tocar su cupo diario de actividades);
//  - cada llamada reserva su costo máximo del presupuesto global del mes ANTES de llamar;
//  - tras llamar se consume el costo real; si no se conoce, se consume lo reservado (nunca queda retenido ni en cero).
// Dependencias: sugerirRepaso (SugerirRepaso), redactor (IRedactorRecomendacion), cuotaRepository (ICuotaRepository), config.
class RecomendarRepaso {
  constructor({ sugerirRepaso, redactor, cuotaRepository, config }) {
    Object.assign(this, { sugerirRepaso, redactor, cuotaRepository, config });
  }

  async ejecutar(docenteId, filtros = {}, ahora = new Date()) {
    if (!this.config.habilitada) {
      throw new ServicioNoDisponible("La recomendación con IA no está disponible por ahora.", "RECOMENDACION_DESHABILITADA");
    }
    const analisis = await this.sugerirRepaso.ejecutar(docenteId, filtros);
    if (!analisis.suficiente) {
      throw new ConflictoDeEstado("Todavía hay pocas respuestas para recomendar algo. Juega más actividades y vuelve a intentarlo.", "DATOS_INSUFICIENTES");
    }

    const reservas = await this.reservar(docenteId, ahora);
    let resultado;
    try {
      resultado = await this.pedirRecomendacion(analisis);
    } catch (error) {
      await this.registrarConsumo(reservas, error.uso);
      throw error;
    }
    await this.registrarConsumo(reservas, resultado.uso);
    return { ...resultado.recomendacion, cupoRestante: reservas.docente.cuota.disponible(this.config.maxRecomendaciones) };
  }

  async reservar(docenteId, ahora) {
    const periodo = periodoMensual(ahora, this.config.zonaHoraria);
    const docente = await this.cuotaRepository.reservar({ docenteId, periodo, cantidad: 1, limite: this.config.maxRecomendaciones });
    if (!docente.reservada) {
      throw new LimiteAlcanzado("Ya usaste todas las recomendaciones con IA de este mes.", "RECOMENDACIONES_AGOTADAS");
    }
    try {
      const global = await this.cuotaRepository.reservar({ periodo, cantidad: this.config.costoMaximoLlamada, limite: this.config.presupuestoMensual });
      if (!global.reservada) {
        // No se expone el presupuesto global: es un dato de administración
        throw new LimiteAlcanzado("La recomendación con IA no está disponible por ahora.", "PRESUPUESTO_AGOTADO");
      }
      return { docente: { cuota: docente.cuota, cantidad: 1 }, global: { cuota: global.cuota, cantidad: this.config.costoMaximoLlamada } };
    } catch (error) {
      await this.cuotaRepository.liberar({ cuotaId: docente.cuota.id, cantidad: 1 })
        .catch((e) => console.error("No se pudo devolver el cupo de recomendación", docente.cuota.id, e));
      throw error;
    }
  }

  async pedirRecomendacion(analisis) {
    let resultado;
    try {
      resultado = await this.llamarRedactor(analisis);
    } catch (error) {
      const delGenerador = error instanceof ErrorDelGenerador;
      console.error(`Recomendación de repaso fallida (${delGenerador ? error.codigo : "GENERADOR_ERROR"}): ${delGenerador ? error.message : "error inesperado del redactor"}`);
      throw delGenerador ? error : new ErrorDelGenerador("No se pudo redactar la recomendación", "GENERADOR_ERROR");
    }
    try {
      return { recomendacion: new RecomendacionRepaso(resultado.propuesta), uso: resultado.uso };
    } catch (error) {
      if (!(error instanceof EntradaInvalida)) throw error;
      throw new ErrorDelGenerador("La IA devolvió una recomendación inválida", "GENERADOR_RESPUESTA_INVALIDA", resultado.uso);
    }
  }

  // Tiempo límite duro: aunque el redactor ignore la señal de cancelación, la espera termina
  llamarRedactor(analisis) {
    const controlador = new AbortController();
    let temporizador;
    const limite = new Promise((_, rechazar) => {
      temporizador = setTimeout(() => {
        controlador.abort();
        rechazar(new ErrorDelGenerador("El redactor no respondió a tiempo", "GENERADOR_TIEMPO_AGOTADO"));
      }, this.config.tiempoLimiteMs);
    });
    const llamada = Promise.resolve().then(() => this.redactor.redactar(analisis, { signal: controlador.signal }));
    llamada.catch(() => {}); // si responde tarde y falla, nadie la espera: evita un rechazo sin manejar
    return Promise.race([llamada, limite]).finally(() => clearTimeout(temporizador));
  }

  // El cupo del docente se consume siempre que hubo llamada; el presupuesto, al costo real o, si no se conoce, lo reservado.
  // Un fallo al registrar no debe tapar el resultado (ni el error original): se deja constancia en el registro.
  async registrarConsumo({ docente, global }, uso) {
    const costo = this.config.costoDe(uso);
    try {
      await this.cuotaRepository.consumir({ cuotaId: docente.cuota.id, cantidad: docente.cantidad });
      await this.cuotaRepository.consumir({ cuotaId: global.cuota.id, cantidad: global.cantidad, real: costo ?? global.cantidad });
    } catch (error) {
      console.error("No se pudo registrar el consumo de la recomendación", docente.cuota.id, global.cuota.id, error);
    }
  }
}

module.exports = RecomendarRepaso;

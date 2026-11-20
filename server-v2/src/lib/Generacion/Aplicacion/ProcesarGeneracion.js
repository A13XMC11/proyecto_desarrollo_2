const Juego = require("../../Juego/Dominio/Entidades/Juego");
const VersionJuego = require("../../Juego/Dominio/Entidades/VersionJuego");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const { recursosParaGeneracion } = require("../Dominio/Entidades/RecursosParaGeneracion");

const TITULO_POR_DEFECTO = "Actividad generada con IA";
// Solo para validar el contenido antes de crear el juego: la versión real se crea con el id del juego
const JUEGO_CANDIDATO = "candidato";

const tituloSeguro = (titulo) => {
  const limpio = typeof titulo === "string" ? titulo.trim() : "";
  return limpio.length >= 3 && limpio.length <= 80 ? limpio : TITULO_POR_DEFECTO;
};

function conTiempoLimite(promesa, ms) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => {
      const error = new Error("El proveedor de IA no respondió a tiempo");
      error.codigo = "TIEMPO_AGOTADO";
      rechazar(error);
    }, ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

// Pasos 5 a 8 del flujo técnico (§13): procesando → llamada con tiempo límite → validación pedagógica →
// juego y versión en borrador vinculados a la generación → completada y liquidación del cupo.
// Se lanza en segundo plano desde SolicitarGeneracion; el docente consulta el estado por el id.
class ProcesarGeneracion {
  constructor(
    { generacionRepository, juegoRepository, versionRepository, catalogo, generador, liquidarReserva },
    { tiempoLimiteMs = 60000, permitirDiez = false } = {}
  ) {
    this.generacionRepository = generacionRepository;
    this.juegoRepository = juegoRepository;
    this.versionRepository = versionRepository;
    this.catalogo = catalogo;
    this.generador = generador;
    this.liquidarReserva = liquidarReserva;
    this.tiempoLimiteMs = tiempoLimiteMs;
    this.permitirDiez = permitirDiez;
  }

  async ejecutar(id, docenteId) {
    // Transición condicional: si ya no está pendiente (cancelada o procesada) no se hace nada
    const generacion = await this.generacionRepository.marcarProcesando(id, docenteId);
    if (!generacion) return null;
    const { parametros } = generacion;

    let resultado;
    try {
      resultado = await conTiempoLimite(
        this.generador.generar({
          habilidad: parametros.habilidad,
          mecanica: generacion.mecanica,
          tematica: parametros.tematica,
          cantidad: parametros.cantidad,
          instruccion: parametros.instruccion,
          recursos: recursosParaGeneracion(this.catalogo, parametros)
        }),
        this.tiempoLimiteMs
      );
    } catch (error) {
      return this.registrarFalloDelProveedor(generacion, error);
    }

    const uso = resultado.uso || { usoDesconocido: true };
    const configuracion = {
      habilidad: parametros.habilidad,
      mecanica: generacion.mecanica,
      tematica: parametros.tematica,
      cantidadEjercicios: parametros.cantidad
    };

    let juego;
    try {
      // Validación pedagógica completa antes de escribir nada: el contenido inválido no llega a la biblioteca
      VersionJuego.rechazarCamposDesconocidos(resultado.ejercicios);
      new VersionJuego({ juegoId: JUEGO_CANDIDATO, configuracion, ejercicios: resultado.ejercicios })
        .validarContenido(this.catalogo, { permitirDiez: this.permitirDiez, exigirCantidad: true });

      // juegos.generacionId es único: si un intento anterior ya guardó el juego, se reutiliza
      juego = await this.juegoRepository.findByGeneracionId(id, docenteId);
      if (!juego) {
        juego = await this.juegoRepository.save(new Juego({
          docenteId,
          cursoId: parametros.cursoId,
          estudianteId: parametros.estudianteId,
          generacionId: id,
          titulo: tituloSeguro(resultado.titulo),
          habilidad: parametros.habilidad,
          mecanica: generacion.mecanica,
          origen: "ia"
        }));
      }
      const borrador = await this.versionRepository.findBorradorByJuego(juego.id);
      if (!borrador) {
        await this.versionRepository.save(new VersionJuego({ juegoId: juego.id, configuracion, ejercicios: resultado.ejercicios }));
      }
    } catch (error) {
      if (!(error instanceof EntradaInvalida)) throw error; // fallo de base de datos: lo concilia ConciliarGeneraciones
      const fallida = await this.generacionRepository.marcarFallida(id, docenteId, "CONTENIDO_INVALIDO", uso);
      // La llamada ya se hizo: el cupo se consume aunque el contenido no sirva
      if (fallida) await this.liquidarReserva.ejecutar(fallida, { consumir: true });
      return fallida;
    }

    const completada = await this.generacionRepository.marcarCompletada(id, docenteId, juego.id, uso);
    if (!completada) {
      // El docente canceló mientras se generaba: el borrador no debe aparecer en su biblioteca
      await this.juegoRepository.archivar(juego.id, docenteId);
      return null;
    }
    await this.liquidarReserva.ejecutar(completada, { consumir: true });
    return completada;
  }

  async registrarFalloDelProveedor(generacion, error) {
    const { id, docenteId } = generacion;
    if (error && error.codigo === "TIEMPO_AGOTADO") {
      // La llamada pudo tener costo: queda interrumpida, sin reintento automático, y el cupo se consume
      const interrumpida = await this.generacionRepository.marcarInterrumpida(id, docenteId, (error && error.uso) || {});
      if (interrumpida) await this.liquidarReserva.ejecutar(interrumpida, { consumir: true });
      return interrumpida;
    }
    const codigo = error && typeof error.codigo === "string" ? error.codigo.slice(0, 60) : "PROVEEDOR_ERROR";
    const fallida = await this.generacionRepository.marcarFallida(id, docenteId, codigo, (error && error.uso) || { usoDesconocido: true });
    // Solo se cobra el cupo si el proveedor informó consumo
    if (fallida) await this.liquidarReserva.ejecutar(fallida, { consumir: Boolean(error && error.uso) });
    return fallida;
  }
}

module.exports = ProcesarGeneracion;

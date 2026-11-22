const Juego = require("../../Juego/Dominio/Entidades/Juego");
const VersionJuego = require("../../Juego/Dominio/Entidades/VersionJuego");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const ErrorDelGenerador = require("../../Compartido/Dominio/Errores/ErrorDelGenerador");
const { recursosParaGeneracion } = require("../Dominio/Entidades/RecursosParaGeneracion");

// La versión se valida antes de que exista el juego que la contendrá
const SIN_JUEGO = "pendiente-de-guardar";
const MAX_TEXTO_PROVEEDOR = 100; // largo de las columnas proveedor y modelo

// Ejecuta la llamada acotada al generador y entrega el resultado: pasos 5 a 8 del flujo (§7.4.5).
// Recibe una generación "procesando" con su cupo ya reservado.
// Cupo: si el generador falla o el contenido es inválido, el cupo diario queda consumido (pudo haber costo);
// el consumo real se registra cuando se conoce y, si no, la reserva global se mantiene hasta conciliar.
class ProcesarGeneracion {
  constructor({ generacionRepository, juegoRepository, versionRepository, estudianteRepository, generador, catalogo, config, registrarConsumo, liberarReserva }) {
    Object.assign(this, { generacionRepository, juegoRepository, versionRepository, estudianteRepository, generador, catalogo, config, registrarConsumo, liberarReserva });
  }

  async ejecutar(generacion) {
    // Preparar la solicitud no es llamar al proveedor: si falla (p. ej. un corte de la base de datos) no hubo
    // llamada posible, así que no se cobra como fallo del proveedor y la reserva vuelve.
    let solicitud;
    try {
      solicitud = await this.armarSolicitud(generacion);
    } catch (error) {
      await this.generacionRepository.marcarFallida(generacion.id, generacion.docenteId, "ERROR_AL_PREPARAR");
      await this.liberarReserva.ejecutar(generacion);
      throw error;
    }

    let resultado;
    try {
      resultado = await this.llamarGenerador(solicitud);
    } catch (error) {
      return await this.fallarSinResultado(generacion, error);
    }
    return await this.guardar(generacion, resultado);
  }

  // El generador solo recibe lo necesario: nada que identifique a docentes ni a estudiantes
  async armarSolicitud({ docenteId, parametros, mecanica }) {
    const estudiante = parametros.estudianteId && await this.estudianteRepository.findById(parametros.estudianteId, docenteId);
    return {
      habilidad: parametros.habilidad,
      mecanica,
      tematica: parametros.tematica,
      cantidad: parametros.cantidad,
      franjaEdad: estudiante ? estudiante.franjaEdad : undefined,
      instruccion: parametros.instruccion,
      recursos: recursosParaGeneracion(this.catalogo, parametros)
    };
  }

  // Tiempo límite duro: aunque el generador ignore la señal de cancelación, la espera termina
  llamarGenerador(solicitud) {
    const controlador = new AbortController();
    let temporizador;
    const limite = new Promise((_, rechazar) => {
      temporizador = setTimeout(() => {
        controlador.abort();
        rechazar(new ErrorDelGenerador("El generador no respondió a tiempo", "GENERADOR_TIEMPO_AGOTADO"));
      }, this.config.tiempoLimiteMs);
    });
    const llamada = Promise.resolve().then(() => this.generador.generar(solicitud, { signal: controlador.signal }));
    llamada.catch(() => {}); // si responde tarde y falla, nadie la espera: evita un rechazo sin manejar
    return Promise.race([llamada, limite]).finally(() => clearTimeout(temporizador));
  }

  // Sin resultado utilizable. El consumo se desconoce salvo que el proveedor lo haya informado antes de fallar
  // (p. ej. una respuesta cortada): así la reserva global se ajusta al costo real y no queda retenida.
  async fallarSinResultado(generacion, error) {
    const delGenerador = error instanceof ErrorDelGenerador;
    const codigo = delGenerador ? error.codigo : "GENERADOR_ERROR";
    // Los mensajes de ErrorDelGenerador ya vienen saneados (sin clave ni cuerpo del proveedor)
    console.error(`Generación ${generacion.id} fallida (${codigo}): ${delGenerador ? error.message : "error inesperado del generador"}`);
    const usoInformado = delGenerador && error.uso ? this.usoDe(error.uso) : undefined;
    if (usoInformado && !usoInformado.usoDesconocido) {
      await this.generacionRepository.marcarFallida(generacion.id, generacion.docenteId, codigo, usoInformado);
      await this.consumir(generacion, error.uso);
    } else {
      await this.generacionRepository.marcarFallida(generacion.id, generacion.docenteId, codigo, { usoDesconocido: true });
      await this.consumir(generacion, undefined);
    }
    return await this.estadoFinal(generacion);
  }

  async guardar(generacion, { titulo, ejercicios, uso: usoProveedor = {} }) {
    const uso = this.usoDe(usoProveedor);
    let contenido;
    try {
      contenido = this.validar(generacion, titulo, ejercicios);
    } catch (error) {
      if (!(error instanceof EntradaInvalida)) throw error;
      return await this.cerrarFallida(generacion, "CONTENIDO_INVALIDO", uso, usoProveedor);
    }

    let juego;
    try {
      juego = await this.persistir(generacion, contenido);
    } catch (error) {
      await this.cerrarFallida(generacion, "ERROR_AL_GUARDAR", uso, usoProveedor);
      throw error;
    }

    const completada = await this.generacionRepository.marcarCompletada(generacion.id, generacion.docenteId, juego.id, uso);
    if (!completada) await this.ocultarSiSeCancelo(generacion, juego);
    await this.consumir(generacion, usoProveedor);
    return await this.estadoFinal(generacion);
  }

  // La salida del generador es una propuesta no confiable: se valida entera contra el catálogo
  validar({ parametros, mecanica, id, docenteId }, titulo, ejercicios) {
    if (!Array.isArray(ejercicios)) throw new EntradaInvalida("ejercicios inválidos");
    VersionJuego.rechazarCamposDesconocidos(ejercicios);
    const configuracion = { habilidad: parametros.habilidad, mecanica, tematica: parametros.tematica, cantidadEjercicios: parametros.cantidad };
    new VersionJuego({ juegoId: SIN_JUEGO, configuracion, ejercicios })
      .validarContenido(this.catalogo, { permitirDiez: this.config.permitirDiez });
    const juego = new Juego({
      docenteId, cursoId: parametros.cursoId, estudianteId: parametros.estudianteId, generacionId: id,
      titulo, habilidad: parametros.habilidad, mecanica, origen: "ia"
    });
    return { juego, configuracion, ejercicios };
  }

  // Juego y versión en borrador, vinculados a la generación. Tras una caída a medias se reutiliza lo ya guardado,
  // así no se duplica el borrador (la referencia generacionId es única).
  async persistir(generacion, { juego, configuracion, ejercicios }) {
    let guardado;
    try {
      guardado = await this.juegoRepository.save(juego);
    } catch (error) {
      if (error.codigo !== "GENERACION_YA_TIENE_JUEGO") throw error;
      guardado = await this.juegoRepository.findByGeneracionId(generacion.id, generacion.docenteId);
    }
    if (!(await this.versionRepository.findByJuego(guardado.id)).length) {
      await this.versionRepository.save(new VersionJuego({ juegoId: guardado.id, configuracion, ejercicios }));
    }
    return guardado;
  }

  async cerrarFallida(generacion, codigo, uso, usoProveedor) {
    await this.generacionRepository.marcarFallida(generacion.id, generacion.docenteId, codigo, uso);
    await this.consumir(generacion, usoProveedor);
    return await this.estadoFinal(generacion);
  }

  // Si el docente canceló mientras se generaba, el borrador no debe quedar a la vista. Solo entonces: si otra
  // vía (la conciliación) ya completó la generación, su juego es el legítimo y no se toca.
  async ocultarSiSeCancelo(generacion, juego) {
    const actual = await this.generacionRepository.findById(generacion.id, generacion.docenteId);
    if (actual && actual.estado === "fallida") await this.juegoRepository.archivar(juego.id, generacion.docenteId);
  }

  // El llamado al proveedor ya ocurrió: un fallo al registrar el consumo no debe convertir el resultado en un
  // error para el docente. Queda en el registro del servidor y la reserva pendiente de conciliar.
  async consumir(generacion, uso) {
    try {
      await this.registrarConsumo.ejecutar(generacion, uso);
    } catch (error) {
      console.error(`No se pudo registrar el consumo de la generación ${generacion.id}; la reserva queda pendiente de conciliar:`, error);
    }
  }

  // Se relee al final: el registro del consumo cambia la reserva después de cerrar la generación
  async estadoFinal(generacion) {
    return await this.generacionRepository.findById(generacion.id, generacion.docenteId);
  }

  // Lo que se guarda del uso. Es información del proveedor, no confiable: solo se persiste lo válido
  // (tokens enteros no negativos, textos acotados) y lo demás queda como consumo desconocido.
  usoDe({ proveedor, modelo, tokensEntrada, tokensSalida }) {
    const tokenValido = (t) => Number.isInteger(t) && t >= 0;
    const texto = (t) => (typeof t === "string" && t.trim() ? t.trim().slice(0, MAX_TEXTO_PROVEEDOR) : undefined);
    const conocido = this.config.costoDe({ tokensEntrada, tokensSalida }) !== undefined;
    return {
      proveedor: texto(proveedor),
      modelo: texto(modelo),
      ...(tokenValido(tokensEntrada) && { tokensEntrada }),
      ...(tokenValido(tokensSalida) && { tokensSalida }),
      usoDesconocido: !conocido
    };
  }
}

module.exports = ProcesarGeneracion;

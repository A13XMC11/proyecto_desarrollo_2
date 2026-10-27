const SesionJuego = require("../Dominio/Entidades/SesionJuego");
const SesionJuegoModel = require("./SesionJuegoModel");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

const esObjectId = (valor) => typeof valor === "string" && /^[0-9a-f]{24}$/i.test(valor);
const esUuid = (valor) => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
const esDuplicado = (error) => Boolean(error) && error.code === 11000;

const LIMITE_RESULTADOS = 2000;
const LIMITE_LISTAS = 50;
const acotar = (limite, defecto) =>
  Math.min(Number.isInteger(limite) && limite > 0 ? limite : defecto, LIMITE_LISTAS);

class SesionJuegoRepositoryMongoose {
  async save(sesion) {
    try {
      const doc = await SesionJuegoModel.create({
        docenteId: sesion.docenteId,
        cursoId: sesion.cursoId,
        estudianteId: sesion.estudianteId,
        juegoId: sesion.juegoId,
        versionId: sesion.versionId,
        canalInicioId: sesion.canalInicioId,
        estado: sesion.estado,
        ejercicioActual: sesion.ejercicioActual,
        semilla: sesion.semilla,
        intentos: sesion.intentos.map((i) => ({ ...i })),
        pistas: sesion.pistas.map((p) => ({ ...p })),
        iniciadaEn: sesion.iniciadaEn
      });
      return this.aEntidad(doc.toObject());
    } catch (error) {
      if (esDuplicado(error)) {
        throw new ConflictoDeEstado(
          "Ya existe una partida en curso de ese estudiante en ese juego",
          "PARTIDA_EN_CURSO_EXISTENTE"
        );
      }
      throw error;
    }
  }

  async findById(id, docenteId) {
    if (!esObjectId(id) || !esUuid(docenteId)) return null;
    const doc = await SesionJuegoModel.findOne({ _id: id, docenteId }).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  async findEnCurso(estudianteId, juegoId, docenteId) {
    if (!esUuid(estudianteId) || !esObjectId(juegoId) || !esUuid(docenteId)) return null;
    const doc = await SesionJuegoModel.findOne({ estudianteId, juegoId, docenteId, estado: "en_curso" }).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  // Idempotente por operacionId: el $ne y el $push ocurren en una sola operación atómica
  // sobre el documento, así que dos envíos simultáneos de la misma operación cuentan una vez.
  // Devuelve { registrado, sesion }; sesion es null si no existe o es ajena.
  // `esperado` ({ ejercicioActual, intentosPrevios }) hace atómicas las reglas del servidor: el intento solo
  // se agrega si la partida sigue en ese ejercicio y con ese número de intentos previos en él. Así dos
  // peticiones simultáneas con operaciones distintas no pueden numerar igual ni exceder el límite.
  async registrarIntento(id, docenteId, intento, esperado) {
    const condiciones = esperado
      ? {
          ejercicioActual: esperado.ejercicioActual,
          $expr: {
            $eq: [
              { $size: { $filter: { input: "$intentos", cond: { $eq: ["$$this.ejercicioId", intento.ejercicioId] } } } },
              esperado.intentosPrevios
            ]
          }
        }
      : {};
    return this.agregarOperacion(id, docenteId, "intentos", condiciones, {
      ejercicioId: intento.ejercicioId,
      numeroIntento: intento.numeroIntento,
      eleccion: intento.eleccion,
      esCorrecto: intento.esCorrecto,
      usoPista: intento.usoPista,
      operacionId: intento.operacionId,
      creadoEn: intento.creadoEn || new Date()
    });
  }

  async registrarPista(id, docenteId, pista) {
    return this.agregarOperacion(id, docenteId, "pistas", {}, {
      ejercicioId: pista.ejercicioId,
      operacionId: pista.operacionId,
      creadoEn: pista.creadoEn || new Date()
    });
  }

  async agregarOperacion(id, docenteId, arreglo, condiciones, elemento) {
    if (!esObjectId(id) || !esUuid(docenteId)) return { registrado: false, sesion: null };

    const actualizada = await SesionJuegoModel.findOneAndUpdate(
      { _id: id, docenteId, estado: "en_curso", [`${arreglo}.operacionId`]: { $ne: elemento.operacionId }, ...condiciones },
      { $push: { [arreglo]: elemento } },
      { new: true, runValidators: true }
    ).lean();
    if (actualizada) return { registrado: true, sesion: this.aEntidad(actualizada) };

    const actual = await SesionJuegoModel.findOne({ _id: id, docenteId }).lean();
    return { registrado: false, sesion: actual ? this.aEntidad(actual) : null };
  }

  // Monótono: $max impide retroceder el ejercicio actual por peticiones desordenadas.
  async actualizarEjercicioActual(id, docenteId, indice) {
    if (!esObjectId(id) || !esUuid(docenteId) || !Number.isInteger(indice) || indice < 0) return null;
    const doc = await SesionJuegoModel.findOneAndUpdate(
      { _id: id, docenteId, estado: "en_curso" },
      { $max: { ejercicioActual: indice } },
      { new: true }
    ).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  async finalizar(id, docenteId) {
    return this.cerrar(id, docenteId, "finalizada");
  }

  async abandonar(id, docenteId) {
    return this.cerrar(id, docenteId, "abandonada");
  }

  async cerrar(id, docenteId, estado) {
    if (!esObjectId(id) || !esUuid(docenteId)) return null;
    const doc = await SesionJuegoModel.findOneAndUpdate(
      { _id: id, docenteId, estado: "en_curso" },
      { $set: { estado, finalizadaEn: new Date() } },
      { new: true }
    ).lean();
    return doc ? this.aEntidad(doc) : null;
  }

  // Rango [desde, hasta) sobre creadoEn. La habilidad se resuelve con $lookup a
  // versionesJuego (por nombre de colección, sin importar el modelo de otro módulo).
  async findByFiltros(docenteId, { cursoId, estudianteId, habilidad, desde, hasta, estado } = {}) {
    if (!esUuid(docenteId)) return [];
    const match = { docenteId };
    for (const [campo, valor] of [["cursoId", cursoId], ["estudianteId", estudianteId]]) {
      if (valor === undefined) continue;
      if (!esUuid(valor)) return [];
      match[campo] = valor;
    }
    if (typeof estado === "string") match.estado = estado;
    if (desde || hasta) {
      match.creadoEn = {};
      if (desde) match.creadoEn.$gte = new Date(desde);
      if (hasta) match.creadoEn.$lt = new Date(hasta);
    }

    const etapas = [{ $match: match }];
    if (typeof habilidad === "string") {
      etapas.push(
        {
          $lookup: {
            from: "versionesJuego",
            localField: "versionId",
            foreignField: "_id",
            pipeline: [{ $project: { "configuracion.habilidad": 1 } }],
            as: "versionJugada"
          }
        },
        { $match: { "versionJugada.configuracion.habilidad": habilidad } },
        { $project: { versionJugada: 0 } }
      );
    }
    etapas.push({ $sort: { creadoEn: -1, _id: -1 } }, { $limit: LIMITE_RESULTADOS });

    const docs = await SesionJuegoModel.aggregate(etapas);
    return docs.map((doc) => this.aEntidad(doc));
  }

  async listarRecientes(docenteId, limite = 10) {
    if (!esUuid(docenteId)) return [];
    const docs = await SesionJuegoModel.find({ docenteId })
      .sort({ creadoEn: -1, _id: -1 })
      .limit(acotar(limite, 10))
      .lean();
    return docs.map((doc) => this.aEntidad(doc));
  }

  async listarEnCurso(docenteId, limite = 10) {
    if (!esUuid(docenteId)) return [];
    const docs = await SesionJuegoModel.find({ docenteId, estado: "en_curso" })
      .sort({ creadoEn: -1, _id: -1 })
      .limit(acotar(limite, 10))
      .lean();
    return docs.map((doc) => this.aEntidad(doc));
  }

  aEntidad(doc) {
    return new SesionJuego({
      id: doc._id.toString(),
      docenteId: doc.docenteId.toString(),
      cursoId: doc.cursoId.toString(),
      estudianteId: doc.estudianteId.toString(),
      juegoId: doc.juegoId.toString(),
      versionId: doc.versionId.toString(),
      canalInicioId: doc.canalInicioId.toString(),
      estado: doc.estado,
      ejercicioActual: doc.ejercicioActual,
      semilla: doc.semilla,
      intentos: doc.intentos || [],
      pistas: doc.pistas || [],
      iniciadaEn: doc.iniciadaEn,
      finalizadaEn: doc.finalizadaEn || undefined,
      creadoEn: doc.creadoEn,
      actualizadoEn: doc.actualizadoEn
    });
  }
}

module.exports = SesionJuegoRepositoryMongoose;

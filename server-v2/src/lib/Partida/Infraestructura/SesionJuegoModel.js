const { Schema, model } = require("mongoose");
const {
  ESTADOS_SESION,
  NUMEROS_INTENTO
} = require("../../Compartido/Dominio/ValoresPermitidos");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/; // referencia a una fila de PostgreSQL: sin clave foránea entre motores

const esTextoOListaDeTextos = (v) =>
  typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string"));

const IntentoSchema = new Schema(
  {
    ejercicioId: { type: String, required: true, trim: true },
    numeroIntento: { type: Number, required: true, enum: NUMEROS_INTENTO },
    eleccion: {
      type: Schema.Types.Mixed,
      required: true,
      validate: { validator: esTextoOListaDeTextos, message: "La elección debe ser texto o lista de textos" }
    },
    esCorrecto: { type: Boolean, required: true },
    usoPista: { type: Boolean, default: false },
    operacionId: { type: String, required: true, trim: true },
    creadoEn: { type: Date, default: Date.now }
  },
  { _id: false }
);

const PistaSchema = new Schema(
  {
    ejercicioId: { type: String, required: true, trim: true },
    operacionId: { type: String, required: true, trim: true },
    creadoEn: { type: Date, default: Date.now }
  },
  { _id: false }
);

const SesionJuegoSchema = new Schema(
  {
    docenteId: { type: String, required: true, trim: true, match: UUID },
    cursoId: { type: String, required: true, trim: true, match: UUID },
    estudianteId: { type: String, required: true, trim: true, match: UUID },
    juegoId: { type: Schema.Types.ObjectId, ref: "Juego", required: true },
    versionId: { type: Schema.Types.ObjectId, ref: "VersionJuego", required: true },
    canalInicioId: { type: Schema.Types.ObjectId, ref: "Canal", required: true },
    estado: { type: String, required: true, enum: ESTADOS_SESION, default: "en_curso" },
    ejercicioActual: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    semilla: { type: Number },
    intentos: { type: [IntentoSchema], default: [] },
    pistas: { type: [PistaSchema], default: [] },
    iniciadaEn: { type: Date, default: Date.now },
    finalizadaEn: { type: Date },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "creadoEn", updatedAt: "actualizadoEn" }
  }
);

SesionJuegoSchema.index({ estudianteId: 1, juegoId: 1, estado: 1 }, { name: "partidas_por_estudiante_juego" });
SesionJuegoSchema.index({ docenteId: 1, creadoEn: -1 }, { name: "partidas_recientes_por_docente" });
SesionJuegoSchema.index({ docenteId: 1, cursoId: 1, estado: 1 }, { name: "resultados_por_curso" });
// Una sola partida en curso por estudiante y juego
SesionJuegoSchema.index(
  { estudianteId: 1, juegoId: 1 },
  {
    unique: true,
    name: "una_partida_en_curso_parcial",
    partialFilterExpression: { estado: "en_curso" }
  }
);

module.exports = model("SesionJuego", SesionJuegoSchema, "sesionesJuego");

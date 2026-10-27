const { Schema, model } = require("mongoose");
const {
  HABILIDADES,
  MECANICAS,
  ORIGENES_JUEGO,
  ESTADOS_JUEGO,
  COMPATIBILIDAD
} = require("../../Compartido/Dominio/ValoresPermitidos");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/; // referencia a una fila de PostgreSQL: sin clave foránea entre motores

const JuegoSchema = new Schema(
  {
    docenteId: { type: String, required: true, trim: true, match: UUID },
    cursoId: { type: String, required: true, trim: true, match: UUID },
    estudianteId: { type: String, trim: true, match: UUID },
    generacionId: { type: String, trim: true, match: UUID },
    titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    habilidad: { type: String, required: true, enum: HABILIDADES },
    mecanica: {
      type: String,
      required: true,
      enum: MECANICAS,
      validate: {
        validator(valor) {
          return !this.habilidad || COMPATIBILIDAD[this.habilidad] === valor;
        },
        message: "La mecánica no es compatible con la habilidad"
      }
    },
    origen: { type: String, required: true, enum: ORIGENES_JUEGO },
    estado: { type: String, required: true, enum: ESTADOS_JUEGO, default: "borrador" },
    // Nulo hasta la primera aprobación
    versionActualId: { type: Schema.Types.ObjectId, ref: "VersionJuego", default: null },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "creadoEn", updatedAt: "actualizadoEn" }
  }
);

JuegoSchema.index({ docenteId: 1, estado: 1, actualizadoEn: -1 }, { name: "biblioteca_por_estado" });
JuegoSchema.index({ docenteId: 1, cursoId: 1 }, { name: "biblioteca_por_curso" });
// Una generación no puede producir dos juegos
JuegoSchema.index(
  { generacionId: 1 },
  {
    unique: true,
    name: "generacion_unica_parcial",
    partialFilterExpression: { generacionId: { $type: "string" } }
  }
);

module.exports = model("Juego", JuegoSchema, "juegos");

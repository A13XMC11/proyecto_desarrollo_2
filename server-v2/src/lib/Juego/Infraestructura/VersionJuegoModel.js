const { Schema, model } = require("mongoose");
const {
  HABILIDADES,
  MECANICAS,
  TEMATICAS,
  CANTIDADES_EJERCICIOS,
  ESTADOS_VERSION,
  COMPATIBILIDAD
} = require("../../Compartido/Dominio/ValoresPermitidos");

const OpcionSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    texto: { type: String, trim: true },
    recursoId: { type: String, trim: true }
  },
  { _id: false }
);

const PiezaSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    texto: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const EjercicioSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    consigna: { type: String, required: true, trim: true, maxlength: 140 },
    pista: { type: String, trim: true, maxlength: 100 },
    objetivo: { type: String, trim: true },
    recursoId: { type: String, trim: true },
    // seleccionar_opcion
    opciones: { type: [OpcionSchema], default: undefined },
    respuestaCorrectaId: { type: String, trim: true },
    // ordenar_silabas
    palabraId: { type: String, trim: true },
    piezas: { type: [PiezaSchema], default: undefined },
    ordenCorrecto: { type: [String], default: undefined }
  },
  { _id: false }
);

const VersionJuegoSchema = new Schema(
  {
    juegoId: { type: Schema.Types.ObjectId, ref: "Juego", required: true },
    numero: { type: Number, required: true, min: 1, validate: Number.isInteger },
    formatoVersion: { type: Number, default: 1 },
    configuracion: {
      habilidad: { type: String, required: true, enum: HABILIDADES },
      mecanica: {
        type: String,
        required: true,
        enum: MECANICAS,
        validate: {
          validator(valor) {
            const habilidad = this.configuracion && this.configuracion.habilidad;
            return !habilidad || COMPATIBILIDAD[habilidad] === valor;
          },
          message: "La mecánica no es compatible con la habilidad"
        }
      },
      tematica: { type: String, required: true, enum: TEMATICAS },
      cantidadEjercicios: { type: Number, required: true, enum: CANTIDADES_EJERCICIOS }
    },
    ejercicios: { type: [EjercicioSchema], default: [] },
    estado: { type: String, required: true, enum: ESTADOS_VERSION, default: "borrador" },
    aprobadoEn: { type: Date },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "creadoEn", updatedAt: "actualizadoEn" }
  }
);

VersionJuegoSchema.index({ juegoId: 1, numero: 1 }, { unique: true, name: "numero_unico_por_juego" });
// Un solo borrador activo por juego
VersionJuegoSchema.index(
  { juegoId: 1 },
  {
    unique: true,
    name: "un_borrador_por_juego_parcial",
    partialFilterExpression: { estado: "borrador" }
  }
);

module.exports = model("VersionJuego", VersionJuegoSchema, "versionesJuego");

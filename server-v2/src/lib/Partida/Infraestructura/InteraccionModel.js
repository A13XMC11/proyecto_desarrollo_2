const { Schema, model } = require("mongoose");
const { TIPOS_INTERACCION } = require("../../Compartido/Dominio/ValoresPermitidos");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/; // referencia a una fila de PostgreSQL: sin clave foránea entre motores

// Append-only: solo creadaEn, sin actualizadoEn
const InteraccionSchema = new Schema(
  {
    sesionId: { type: Schema.Types.ObjectId, ref: "SesionJuego" },
    docenteId: { type: String, required: true, trim: true, match: UUID },
    canalId: { type: Schema.Types.ObjectId, ref: "Canal", required: true },
    tipo: { type: String, required: true, enum: TIPOS_INTERACCION },
    operacionId: { type: String, trim: true },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "creadaEn", updatedAt: false }
  }
);

InteraccionSchema.index({ docenteId: 1, creadaEn: -1 }, { name: "interacciones_por_docente" });
InteraccionSchema.index({ sesionId: 1, creadaEn: 1 }, { name: "interacciones_por_sesion" });
// Idempotencia: la misma operación no se registra dos veces con el mismo tipo en una sesión
InteraccionSchema.index(
  { sesionId: 1, operacionId: 1, tipo: 1 },
  {
    unique: true,
    name: "operacion_unica_por_sesion_tipo_parcial",
    partialFilterExpression: { sesionId: { $type: "objectId" }, operacionId: { $type: "string" } }
  }
);

module.exports = model("Interaccion", InteraccionSchema, "interacciones");

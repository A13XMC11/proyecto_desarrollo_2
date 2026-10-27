const { Schema, model } = require("mongoose");
const {
  CODIGOS_CANAL,
  SUPERFICIES,
  DISPOSITIVOS
} = require("../../Compartido/Dominio/ValoresPermitidos");

const CanalSchema = new Schema(
  {
    codigo: { type: String, required: true, enum: CODIGOS_CANAL },
    superficie: {
      type: String,
      required: true,
      enum: SUPERFICIES,
      validate: {
        validator(valor) {
          return !this.dispositivo || this.codigo === `${valor}_${this.dispositivo}`;
        },
        message: "El código del canal debe ser <superficie>_<dispositivo>"
      }
    },
    dispositivo: { type: String, required: true, enum: DISPOSITIVOS },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "creadoEn", updatedAt: "actualizadoEn" }
  }
);

CanalSchema.index({ codigo: 1 }, { unique: true, name: "codigo_unico" });

module.exports = model("Canal", CanalSchema, "canales");

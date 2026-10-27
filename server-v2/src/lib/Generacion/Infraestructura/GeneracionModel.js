const { DataTypes, Op } = require("sequelize");
const { obtenerSequelize } = require("../../../Infraestructura/database/Sequelize");
const {
  HABILIDADES, TEMATICAS, CANTIDADES_EJERCICIOS, ESTADOS_GENERACION
} = require("../../Compartido/Dominio/ValoresPermitidos");

const sequelize = obtenerSequelize();
const OBJECT_ID = /^[0-9a-f]{24}$/;

// canal_id y juego_id apuntan a documentos de MongoDB (ObjectId de 24 hex): no admiten clave foránea.
// La mecánica no se guarda: se deduce de la habilidad (3FN).
const GeneracionModel = sequelize.define(
  "Generacion",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    docenteId: { type: DataTypes.UUID, allowNull: false, references: { model: "usuarios", key: "id" }, onDelete: "RESTRICT" },
    cursoId: { type: DataTypes.UUID, allowNull: false, references: { model: "cursos", key: "id" }, onDelete: "RESTRICT" },
    estudianteId: { type: DataTypes.UUID, references: { model: "estudiantes", key: "id" }, onDelete: "RESTRICT" },
    canalId: { type: DataTypes.STRING(24), allowNull: false, validate: { is: OBJECT_ID } },
    juegoId: { type: DataTypes.STRING(24), unique: true, validate: { is: OBJECT_ID } },
    claveSolicitud: { type: DataTypes.STRING(64), allowNull: false, validate: { len: [16, 64] } },
    habilidad: { type: DataTypes.ENUM(...HABILIDADES), allowNull: false },
    tematica: { type: DataTypes.ENUM(...TEMATICAS), allowNull: false },
    cantidad: { type: DataTypes.SMALLINT, allowNull: false, validate: { isIn: [CANTIDADES_EJERCICIOS] } },
    instruccion: { type: DataTypes.STRING(500) },
    estado: { type: DataTypes.ENUM(...ESTADOS_GENERACION), allowNull: false, defaultValue: "pendiente" },
    proveedor: { type: DataTypes.STRING(100) },
    modelo: { type: DataTypes.STRING(100) },
    tokensEntrada: { type: DataTypes.INTEGER, validate: { min: 0 } },
    tokensSalida: { type: DataTypes.INTEGER, validate: { min: 0 } },
    usoDesconocido: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    errorCodigo: { type: DataTypes.STRING(60) },
    finalizadaEn: { type: DataTypes.DATE }
  },
  {
    tableName: "generaciones_ia",
    createdAt: "creadaEn",
    indexes: [
      // Idempotencia: la misma solicitud del mismo docente no se procesa dos veces
      { name: "solicitud_unica_por_docente", unique: true, fields: ["docente_id", "clave_solicitud"] },
      { name: "generaciones_por_docente_estado", fields: ["docente_id", "estado"] },
      { name: "conciliacion_por_antiguedad", fields: ["creada_en"], where: { estado: { [Op.in]: ["pendiente", "procesando"] } } }
    ]
  }
);

// Reserva de cuota de una generación (0..1): apunta a los dos contadores afectados, de donde salen los periodos
const ReservaModel = sequelize.define(
  "Reserva",
  {
    generacionId: { type: DataTypes.UUID, primaryKey: true },
    cuotaDiariaId: { type: DataTypes.UUID, allowNull: false, references: { model: "cuotas_ia", key: "id" }, onDelete: "RESTRICT" },
    cupoDiario: { type: DataTypes.DOUBLE, allowNull: false, validate: { min: 0 } },
    cuotaGlobalId: { type: DataTypes.UUID, allowNull: false, references: { model: "cuotas_ia", key: "id" }, onDelete: "RESTRICT" },
    montoGlobal: { type: DataTypes.DOUBLE, allowNull: false, validate: { min: 0 } },
    liberada: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  { tableName: "reservas_ia" }
);

GeneracionModel.hasOne(ReservaModel, { as: "reserva", foreignKey: "generacionId", onDelete: "CASCADE" });
ReservaModel.belongsTo(GeneracionModel, { foreignKey: "generacionId" });

module.exports = GeneracionModel;
module.exports.ReservaModel = ReservaModel;

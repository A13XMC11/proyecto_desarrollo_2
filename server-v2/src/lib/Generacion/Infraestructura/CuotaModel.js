const { DataTypes, Op } = require("sequelize");
const { obtenerSequelize } = require("../../../Infraestructura/database/Sequelize");

// Un contador por docente y periodo (docente_id lleno) o un contador global por periodo (docente_id nulo).
const CuotaModel = obtenerSequelize().define(
  "Cuota",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    docenteId: {
      type: DataTypes.UUID,
      references: { model: "usuarios", key: "id" },
      onDelete: "RESTRICT"
    },
    // 'AAAA-MM-DD' (diario) o 'AAAA-MM' (mensual)
    periodo: { type: DataTypes.STRING(10), allowNull: false, validate: { is: /^\d{4}-\d{2}(-\d{2})?$/ } },
    reservado: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    consumido: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0, validate: { min: 0 } }
  },
  {
    tableName: "cuotas_ia",
    indexes: [
      { name: "una_cuota_por_docente_y_periodo", unique: true, fields: ["docente_id", "periodo"], where: { docente_id: { [Op.ne]: null } } },
      { name: "una_cuota_global_por_periodo", unique: true, fields: ["periodo"], where: { docente_id: null } }
    ]
  }
);

module.exports = CuotaModel;

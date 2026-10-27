const { DataTypes } = require("sequelize");
const { obtenerSequelize } = require("../../../Infraestructura/database/Sequelize");
const { GRADOS } = require("../../Compartido/Dominio/ValoresPermitidos");

const CursoModel = obtenerSequelize().define(
  "Curso",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    // Clave foránea hacia el módulo Docente (se referencia la tabla por nombre: sin importar su modelo)
    docenteId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onDelete: "RESTRICT"
    },
    grado: { type: DataTypes.ENUM(...GRADOS), allowNull: false },
    paralelo: { type: DataTypes.STRING(1), allowNull: false, validate: { is: /^[A-Z]$/ } },
    anioLectivo: { type: DataTypes.STRING(9), allowNull: false, validate: { is: /^\d{4}-\d{4}$/ } },
    archivado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  {
    tableName: "cursos",
    indexes: [
      { name: "curso_unico_por_docente", unique: true, fields: ["docente_id", "anio_lectivo", "grado", "paralelo"] }
    ]
  }
);

module.exports = CursoModel;

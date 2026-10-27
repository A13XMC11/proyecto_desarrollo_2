const { DataTypes } = require("sequelize");
const { obtenerSequelize } = require("../../../Infraestructura/database/Sequelize");
const { FRANJAS_EDAD, TEMATICAS } = require("../../Compartido/Dominio/ValoresPermitidos");
const CursoModel = require("./CursoModel");

const sequelize = obtenerSequelize();

const EstudianteModel = sequelize.define(
  "Estudiante",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cursoId: { type: DataTypes.UUID, allowNull: false },
    codigoLista: { type: DataTypes.STRING(6), allowNull: false, validate: { is: /^[A-Z0-9]{1,6}$/ } },
    apodo: { type: DataTypes.STRING(20) },
    franjaEdad: { type: DataTypes.SMALLINT, allowNull: false, validate: { isIn: [FRANJAS_EDAD] } },
    avatarId: { type: DataTypes.STRING(100), allowNull: false },
    archivado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  {
    tableName: "estudiantes",
    indexes: [
      // Incluye archivados: el código no se reutiliza dentro del curso
      { name: "codigo_unico_por_curso", unique: true, fields: ["curso_id", "codigo_lista"] }
    ]
  }
);

// Intereses del estudiante: tabla propia (1FN). La clave primaria compuesta impide repetidos
// y, al haber solo 3 temáticas, el máximo de 5 se cumple por diseño.
const InteresEstudianteModel = sequelize.define(
  "InteresEstudiante",
  {
    estudianteId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    tematica: { type: DataTypes.ENUM(...TEMATICAS), allowNull: false, primaryKey: true }
  },
  { tableName: "estudiante_intereses", timestamps: false }
);

// Relaciones dentro del módulo Aula (generan las claves foráneas al sincronizar)
CursoModel.hasMany(EstudianteModel, { as: "estudiantes", foreignKey: "cursoId", onDelete: "RESTRICT" });
EstudianteModel.belongsTo(CursoModel, { as: "curso", foreignKey: "cursoId" });
EstudianteModel.hasMany(InteresEstudianteModel, { as: "intereses", foreignKey: "estudianteId", onDelete: "CASCADE" });
InteresEstudianteModel.belongsTo(EstudianteModel, { foreignKey: "estudianteId" });

module.exports = EstudianteModel;
module.exports.InteresEstudianteModel = InteresEstudianteModel;

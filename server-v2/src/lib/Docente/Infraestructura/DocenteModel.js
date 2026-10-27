const { DataTypes } = require("sequelize");
const { obtenerSequelize } = require("../../../Infraestructura/database/Sequelize");

// Code first: este modelo crea la tabla "usuarios" al conectar (sync).
const DocenteModel = obtenerSequelize().define(
  "Docente",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nombre: { type: DataTypes.STRING(80), allowNull: false, validate: { len: [2, 80] } },
    // Se guarda ya normalizado: minúsculas y sin espacios
    correo: { type: DataTypes.STRING(254), allowNull: false, unique: true, validate: { isEmail: true, isLowercase: true } },
    // Nunca se expone: hay que pedirlo explícitamente con .scope("conHash")
    hash: { type: DataTypes.TEXT, allowNull: false },
    institucion: { type: DataTypes.STRING(100) }
  },
  {
    tableName: "usuarios",
    defaultScope: { attributes: { exclude: ["hash"] } },
    scopes: { conHash: { attributes: { include: ["hash"] } } }
  }
);

module.exports = DocenteModel;

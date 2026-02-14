const { DataTypes } = require("sequelize");
const db = require("../database/config");

const SalesTypesModel = db.sequelize.define(
  "sale_types",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    note: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.TINYINT, allowNull: true },
  },
  {
    tableName: "sale_types",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = SalesTypesModel;

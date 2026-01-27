const { DataTypes } = require("sequelize");
const db = require("../database/config");

const TablesModel = db.sequelize.define(
  "tables",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    is_active: {
      type: DataTypes.TINYINT,
      allowNull: true,
    },

    name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    ordering: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    deposit: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    hourly_price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    shape_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: "tables",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = TablesModel;

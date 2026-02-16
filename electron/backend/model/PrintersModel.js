const { DataTypes } = require("sequelize");
const db = require("../database/config");

const PrintersModel = db.sequelize.define(
  "printers",
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
    name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    local_name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_cashier: {
      type: DataTypes.TINYINT,
      allowNull: true,
    },
    type: {
      type: DataTypes.TEXT, 
      allowNull: true,
    },
  },
  {
    tableName: "printers",
    timestamps: true,
    paranoid: true, // soft delete
    underscored: true,
  },
);

module.exports = PrintersModel;

const { DataTypes } = require("sequelize");
const db = require("../database/config");

// Generic key-value settings table for local POS config
const AppSettingsModel = db.sequelize.define(
  "app_settings",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: DataTypes.STRING(128), allowNull: false },
    value: { type: DataTypes.TEXT("long"), allowNull: true },
  },
  {
    modelName: "AppSettingsModel",
    tableName: "app_settings",
    underscored: true,
    timestamps: true,
    paranoid: false,
  },
);

module.exports = AppSettingsModel;

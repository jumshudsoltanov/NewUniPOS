const { DataTypes } = require("sequelize");
const db = require("../database/config");

const SalesShiftsModel = db.sequelize.define(
  "sales_shifts",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: DataTypes.STRING(64), allowNull: false },
    profile_id: { type: DataTypes.INTEGER, allowNull: false },
    terminal_id: { type: DataTypes.STRING(64), allowNull: true },
    opened_at: { type: DataTypes.DATE, allowNull: false },
    closed_at: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "open" },
    opened_by_waiter_id: { type: DataTypes.INTEGER, allowNull: true },
    opened_by_name: { type: DataTypes.TEXT, allowNull: true },
    closed_by_waiter_id: { type: DataTypes.INTEGER, allowNull: true },
    closed_by_name: { type: DataTypes.TEXT, allowNull: true },
    starting_cash: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
    report_snapshot: { type: DataTypes.TEXT("long"), allowNull: true },
  },
  {
    modelName: "SalesShiftsModel",
    tableName: "sales_shifts",
    underscored: true,
    timestamps: true,
    paranoid: false,
  },
);

module.exports = SalesShiftsModel;

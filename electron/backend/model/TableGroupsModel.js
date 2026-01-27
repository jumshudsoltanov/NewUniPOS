const { DataTypes } = require("sequelize");
const db = require("../database/config");

const TableGroupsModel = db.sequelize.define(
  "table_groups",
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

    ordering: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    service_fee: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    tableName: "table_groups",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = TableGroupsModel;

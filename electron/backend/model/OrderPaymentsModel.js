const { DataTypes } = require("sequelize");
const db = require("../database/config");

const OrderPaymentsModel = db.sequelize.define(
  "order_payments",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },

    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    order_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    status: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    operator_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    payment_method_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    without_payment_method_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    paid: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 0,
    },
  },
  {
    tableName: "order_payments",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = OrderPaymentsModel;

const { DataTypes } = require("sequelize");
const db = require("../database/config");

const PaymentMethodsModel = db.sequelize.define(
  "payment_methods",
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

    type: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    is_split: {
      type: DataTypes.TINYINT,
      allowNull: false,
    },

    is_tax: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "payment_methods",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = PaymentMethodsModel;

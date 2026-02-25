const { DataTypes } = require("sequelize");
const db = require("../database/config");

const OrdersItemsModel = db.sequelize.define(
  "orders_items",
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

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    is_print: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    is_gift: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    discount_value: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },

    // 1 = percent, 2 = amount
    discount_type: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },

    original_price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    kds_status: {
      type: DataTypes.INTEGER,
      defaultValue: 0, // 0=pending, 1=preparing, 2=ready
    },

    operator_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "orders_items",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = OrdersItemsModel;

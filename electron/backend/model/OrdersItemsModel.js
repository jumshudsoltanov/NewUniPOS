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
    order_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    count: {
      type: DataTypes.FLOAT,
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

    is_timer_status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_timer_clock: {
      type: DataTypes.STRING(255),
      defaultValue: "00:00:00",
    },
    timer_last_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    modifiers: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    portion_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    is_delete_reason_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
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

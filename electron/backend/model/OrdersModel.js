const { DataTypes } = require("sequelize");
const db = require("../database/config");

const OrdersModel = db.sequelize.define(
  "OrdersModel",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },

    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: "orders_uuid_unique",
    },

    profile_id: { type: DataTypes.INTEGER, allowNull: true },
    sale_type: { type: DataTypes.TEXT, allowNull: true },
    terminal_id: { type: DataTypes.TEXT, allowNull: true },

    start_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: true,
    },

    end_date: { type: DataTypes.DATE, allowNull: true },
    hall_id: { type: DataTypes.INTEGER, allowNull: true },
    table_id: { type: DataTypes.INTEGER, allowNull: true },

    amount: { type: DataTypes.FLOAT, allowNull: true },
    service_charge: { type: DataTypes.FLOAT, allowNull: true },
    service_type: { type: DataTypes.TEXT, allowNull: true },
    service_value: { type: DataTypes.FLOAT, allowNull: true },

    discount: { type: DataTypes.FLOAT, allowNull: true },
    discount_type: { type: DataTypes.TEXT, allowNull: true },
    discount_value: { type: DataTypes.FLOAT, allowNull: true },

    rate_per_minute: { type: DataTypes.TEXT, allowNull: true },

    is_active_timer: { type: DataTypes.INTEGER, allowNull: true },
    is_timer_status: { type: DataTypes.INTEGER, allowNull: true },
    is_timer_clock: { type: DataTypes.TEXT, allowNull: true },

    total: { type: DataTypes.FLOAT, allowNull: true },
    status: { type: DataTypes.INTEGER, allowNull: true },
    guest_count: { type: DataTypes.INTEGER, allowNull: true },
    waiter_id: { type: DataTypes.INTEGER, allowNull: true },

    is_selected: { type: DataTypes.INTEGER, allowNull: true },
    deposit: { type: DataTypes.FLOAT, allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    tags: { type: DataTypes.TEXT, allowNull: true },
    check_reason: { type: DataTypes.INTEGER, allowNull: true },
    is_delete_reason_id: { type: DataTypes.INTEGER, allowNull: true },
    is_return: { type: DataTypes.INTEGER, allowNull: true },
    is_print: { type: DataTypes.INTEGER, allowNull: true },
    is_tax: { type: DataTypes.INTEGER, allowNull: true },
    is_locked: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    is_synced: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "orders",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = OrdersModel;

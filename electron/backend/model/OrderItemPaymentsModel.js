const { DataTypes } = require("sequelize");
const db = require("../database/config");

// Çek bağlanmazdan əvvəl seçilmiş məhsullar üzrə edilən qismən ödənişlər
const OrderItemPaymentsModel = db.sequelize.define(
  "order_item_payments",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    profile_id: { type: DataTypes.INTEGER, allowNull: false },
    order_id: { type: DataTypes.TEXT, allowNull: false },
    order_item_id: { type: DataTypes.INTEGER, allowNull: false },
    product_name: { type: DataTypes.STRING, allowNull: true },
    qty: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    payment_method_id: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    payment_name: { type: DataTypes.STRING, allowNull: true },
    // Bölünmüş ödəniş: bu sətrin məbləğinin ödəniş üsulları üzrə payı — JSON [{payment_method_id,name,amount}]
    payment_splits: { type: DataTypes.TEXT, allowNull: true },
    operator_id: { type: DataTypes.INTEGER, allowNull: true },
    operator_name: { type: DataTypes.STRING, allowNull: true },
    // Bir "Ödə" əməliyyatına aid sətirləri birləşdirir (ləğv üçün)
    batch_uuid: { type: DataTypes.STRING, allowNull: false },
  },
  {
    tableName: "order_item_payments",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = OrderItemPaymentsModel;

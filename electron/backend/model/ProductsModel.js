const { DataTypes } = require("sequelize");
const db = require("../database/config");

const ProductsModel = db.sequelize.define(
  "products",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },

    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    price: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },

    /** Saatlıq əlavə məbləğ (₼/saat) — taymer aktiv olanda vaxt ilə vurulur; 0 = yalnız masa saatlığı */
    hourly_price: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },

    discount: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },

    img: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    ordering: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    is_hidden_qr: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },

    is_hidden_pos: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },

    is_highlight_qr: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },

    no_discount: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },

    no_service_fee: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },

    own_set_price: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },

    ingredient: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    printer_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    product_type: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "simple",
    },
    modifier_groups: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    color: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "products",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = ProductsModel;

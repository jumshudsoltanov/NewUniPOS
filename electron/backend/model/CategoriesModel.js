const { DataTypes } = require("sequelize");
const db = require("../database/config");

const CategoriesModel = db.sequelize.define(
  "categories",
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

    general_categorie_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    descriptions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    ordering: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    printer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    img: {
      type: DataTypes.TEXT("long"),
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

    discount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "categories",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = CategoriesModel;

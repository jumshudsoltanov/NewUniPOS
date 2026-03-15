const { DataTypes } = require("sequelize");
const db = require("../database/config");

const GeneralCategoriesModel = db.sequelize.define(
  "general_categories",
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

    name: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    img: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    ordering: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    color: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "general_categories",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = GeneralCategoriesModel;

const { DataTypes } = require("sequelize");
const db = require("../database/config");

const TagsModel = db.sequelize.define(
  "tags",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
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
  },
  {
    tableName: "tags",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = TagsModel;

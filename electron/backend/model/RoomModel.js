const { DataTypes } = require("sequelize");
const db = require("../database/config");

const RoomModel = db.sequelize.define(
  "rooms",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    room_group_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    room_number: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    room_type: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "available",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    floor: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 1,
    },
  },
  {
    tableName: "rooms",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = RoomModel;

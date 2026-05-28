const { DataTypes } = require("sequelize");
const db = require("../database/config");

const ScheduledMessageModel = db.sequelize.define(
  "scheduled_messages",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    phone: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    room_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "pending",
    },
    type: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "info",
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "scheduled_messages",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ScheduledMessageModel;

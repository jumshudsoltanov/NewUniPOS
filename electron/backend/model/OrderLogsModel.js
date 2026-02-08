const { DataTypes } = require("sequelize");
const db = require("../database/config");

const OrderLogsModel = db.sequelize.define(
    "order_logs",
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        order_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        action: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        waiter_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        details: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        time: {
            type: DataTypes.STRING, // Storing formatted time string as requested/used in frontend
            allowNull: true,
        },
    },
    {
        tableName: "order_logs",
        timestamps: true,
        paranoid: true,
        underscored: true,
    }
);

module.exports = OrderLogsModel;

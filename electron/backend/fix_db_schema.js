const { Sequelize, DataTypes } = require("sequelize");
const dbConfig = require("./database/config");

const fixSchema = async () => {
    const queryInterface = dbConfig.sequelize.getQueryInterface();

    console.log("Starting emergency schema update...");

    // Columns for 'printers' table
    const printerColumns = [
        { name: "ip", type: DataTypes.TEXT },
        { name: "port", type: DataTypes.INTEGER },
        { name: "connection_type", type: DataTypes.TEXT, defaultValue: "network" },
        { name: "usb_name", type: DataTypes.TEXT }
    ];

    for (const col of printerColumns) {
        try {
            await queryInterface.addColumn("printers", col.name, {
                type: col.type,
                allowNull: true,
                defaultValue: col.defaultValue || null
            });
            console.log(`Added column ${col.name} to printers table.`);
        } catch (err) {
            if (err.name === 'SequelizeDatabaseError' && err.message.includes('Duplicate column name')) {
                console.log(`Column ${col.name} already exists in printers table.`);
            } else {
                console.error(`Error adding column ${col.name} to printers:`, err.message);
            }
        }
    }

    // Columns for 'profiles' table
    const profileColumns = [
        { name: "is_master_cashier_printing", type: DataTypes.TINYINT, defaultValue: 0 },
        { name: "is_master_product_printing", type: DataTypes.TINYINT, defaultValue: 0 }
    ];

    for (const col of profileColumns) {
        try {
            await queryInterface.addColumn("profiles", col.name, {
                type: col.type,
                allowNull: true,
                defaultValue: col.defaultValue
            });
            console.log(`Added column ${col.name} to profiles table.`);
        } catch (err) {
            if (err.name === 'SequelizeDatabaseError' && err.message.includes('Duplicate column name')) {
                console.log(`Column ${col.name} already exists in profiles table.`);
            } else {
                console.error(`Error adding column ${col.name} to profiles:`, err.message);
            }
        }
    }

    // Handle old column removal if necessary (is_master_printing)
    try {
        // We don't remove it yet to be safe, but we'll assume it's replaced.
        console.log("Schema update finished.");
    } catch (err) { }

    process.exit(0);
};

fixSchema();

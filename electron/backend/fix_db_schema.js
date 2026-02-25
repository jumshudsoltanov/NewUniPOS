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
        { name: "is_master_product_printing", type: DataTypes.TINYINT, defaultValue: 0 },
        { name: "is_kitchen_display_active", type: DataTypes.TINYINT, defaultValue: 0 },
        { name: "kitchen_display_screen_id", type: DataTypes.TEXT }
    ];

    for (const col of profileColumns) {
        try {
            await queryInterface.addColumn("profiles", col.name, {
                type: col.type,
                allowNull: true,
                defaultValue: col.defaultValue !== undefined ? col.defaultValue : null
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

    // Columns for 'orders_items' table
    const orderItemColumns = [
        { name: "kds_status", type: DataTypes.INTEGER, defaultValue: 0 } // 0=pending, 1=preparing, 2=ready
    ];

    for (const col of orderItemColumns) {
        try {
            await queryInterface.addColumn("orders_items", col.name, {
                type: col.type,
                allowNull: true,
                defaultValue: col.defaultValue
            });
            console.log(`Added column ${col.name} to orders_items table.`);
        } catch (err) {
            if (err.name === 'SequelizeDatabaseError' && err.message.includes('Duplicate column name')) {
                console.log(`Column ${col.name} already exists in orders_items table.`);
            } else {
                console.error(`Error adding column ${col.name} to orders_items:`, err.message);
            }
        }
    }

    console.log("Schema update finished.");
    process.exit(0);
};

fixSchema();

const db = require('./database/config');

async function fixSchema() {
    await db.connect();
    const qi = db.sequelize.getQueryInterface();

    const addCol = async (table, col, type, defaultVal) => {
        try {
            await qi.addColumn(table, col, { type: db.Sequelize.DataTypes[type], defaultValue: defaultVal, allowNull: true });
            console.log(`+ Added ${table}.${col}`);
        } catch (e) {
            if (e.message.includes('Duplicate') || e.message.includes('already exists')) {
                console.log(`= ${table}.${col} already exists`);
            } else {
                console.error(`! ${table}.${col} error:`, e.message);
            }
        }
    };

    // profiles table
    await addCol('profiles', 'is_master_cashier_printing', 'TINYINT', 0);
    await addCol('profiles', 'is_master_product_printing', 'TINYINT', 0);
    await addCol('profiles', 'is_customer_receipt_auto_print', 'TINYINT', 0);

    // printers table
    await addCol('printers', 'connection_type', 'TEXT', 'network');
    await addCol('printers', 'usb_name', 'TEXT', null);
    await addCol('printers', 'ip', 'TEXT', null);
    await addCol('printers', 'port', 'INTEGER', null);

    // orders_items table enhancements
    await addCol('orders_items', 'modifiers', 'TEXT', null);
    await addCol('orders_items', 'comment', 'TEXT', null);

    console.log('\nDone!');
    process.exit();
}

fixSchema();

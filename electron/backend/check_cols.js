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
    await addCol('printers', 'local_name', 'TEXT', null);
    await addCol('printers', 'paper_width', 'INTEGER', 48);
    await addCol('printers', 'trailing_space', 'INTEGER', 0);
    await addCol('printers', 'sound_notify', 'TINYINT', 0);
    await addCol('printers', 'cash_drawer', 'TINYINT', 0);
    await addCol('printers', 'fast_print', 'TINYINT', 0);
    await addCol('printers', 'font_family', 'TEXT', 'Arial');
    await addCol('printers', 'paper_size', 'TEXT', '80');
    await addCol('printers', 'cut_mode', 'TEXT', 'full');
    await addCol('printers', 'rotate_180', 'TINYINT', 0);
    await addCol('printers', 'encoding', 'TEXT', 'utf8');
    await addCol('printers', 'copies', 'INTEGER', 1);
    await addCol('printers', 'darkness', 'INTEGER', 5);
    await addCol('printers', 'receipt_header', 'TEXT', null);
    await addCol('printers', 'receipt_footer', 'TEXT', null);
    await addCol('printers', 'bold_header', 'TINYINT', 0);
    await addCol('printers', 'double_height_header', 'TINYINT', 0);
    await addCol('printers', 'print_logo', 'TINYINT', 0);
    await addCol('printers', 'open_drawer_without_print', 'TINYINT', 0);

    // orders_items table enhancements
    await addCol('orders_items', 'modifiers', 'TEXT', null);
    await addCol('orders_items', 'comment', 'TEXT', null);

    // orders_items.count: INTEGER → FLOAT (decimal qty support e.g. 1.5)
    try {
        await qi.changeColumn('orders_items', 'count', { type: db.Sequelize.DataTypes.FLOAT, allowNull: false });
        console.log('+ orders_items.count changed to FLOAT');
    } catch (e) {
        console.log('= orders_items.count change skipped:', e.message);
    }

    console.log('\nDone!');
    process.exit();
}

fixSchema();

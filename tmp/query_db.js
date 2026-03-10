const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../electron/backend/database/database.sqlite'),
  logging: false,
});

async function run() {
  try {
    const orders = await sequelize.query(
      "SELECT uuid, id, total, amount, is_synced, created_at FROM orders ORDER BY created_at DESC LIMIT 5",
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log("LAST 5 ORDERS:");
    console.table(orders);

    if (orders.length > 0) {
        const lastOrderId = orders[0].uuid;
        const items = await sequelize.query(
          `SELECT id, product_id, count, price, deleted_at FROM orders_items WHERE order_id = ?`,
          { replacements: [lastOrderId], type: Sequelize.QueryTypes.SELECT }
        );
        console.log(`ITEMS FOR ORDER ${lastOrderId}:`);
        console.table(items);
        
        const logs = await sequelize.query(
          `SELECT action, details, created_at FROM order_logs WHERE order_id = ? ORDER BY created_at DESC`,
          { replacements: [lastOrderId], type: Sequelize.QueryTypes.SELECT }
        );
        console.log(`LOGS FOR ORDER ${lastOrderId}:`);
        console.table(logs);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

run();

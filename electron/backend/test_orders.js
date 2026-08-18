const { Sequelize } = require('sequelize');
const s = new Sequelize('unipos-new', 'root', '$2a$12$9IuwxtJ27i1RGqV/3m/OB.Lr2tilbrHvVPHUv06MmTMwDSwHTExW.', { host: 'localhost', dialect: 'mariadb', port: 3306, logging: false });
s.query("SELECT id, order_id, product_id, product_type, timer_intervals, price, hourly_price FROM orders_items ORDER BY id DESC LIMIT 5;", { type: Sequelize.QueryTypes.SELECT }).then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); });

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('unipos-new', 'root', '$2a$12$9IuwxtJ27i1RGqV/3m/OB.Lr2tilbrHvVPHUv06MmTMwDSwHTExW.', { host: 'localhost', dialect: 'mariadb', port: 3306, logging: false });
sequelize.query("SELECT id, name, product_type, price, hourly_price, timer_intervals, are_orders_included FROM products LIMIT 1;", { type: Sequelize.QueryTypes.SELECT }).then(r => { console.log(JSON.stringify(r)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });

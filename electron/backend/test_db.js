const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('unipos-new', 'root', '$2a$12$9IuwxtJ27i1RGqV/3m/OB.Lr2tilbrHvVPHUv06MmTMwDSwHTExW.', { host: 'localhost', dialect: 'mariadb', port: 3306, logging: false });
sequelize.query("SELECT id, name, product_type, price, hourly_price, timer_intervals FROM products WHERE name LIKE '%Timer%';", { type: Sequelize.QueryTypes.SELECT })
  .then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });

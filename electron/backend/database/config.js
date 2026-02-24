const { Sequelize } = require("sequelize");

let db = {};

const sequelize = new Sequelize(
  "unipos-new",
  "root",
  "$2a$12$9IuwxtJ27i1RGqV/3m/OB.Lr2tilbrHvVPHUv06MmTMwDSwHTExW.",
  {
    host: "localhost",
    dialect: "mariadb",
    pool: 5,
    retry: 4,
    timezone: "+04:00",
    logging: false,
  },
);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.connect = async () => {
  try {
    await db.sequelize.authenticate();
    console.log("Connected");
  } catch (error) {
    console.log("Error", error);
  }
};



module.exports = db;

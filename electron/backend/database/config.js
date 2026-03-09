const { Sequelize } = require("sequelize");

let db = {};

const sequelize = new Sequelize(
  "unipos-new",
  "root",
  "$2a$12$9IuwxtJ27i1RGqV/3m/OB.Lr2tilbrHvVPHUv06MmTMwDSwHTExW.",
  {
    host: "localhost",
    dialect: "mariadb",
    pool: {
      max: 20,
      min: 5,
      acquire: 10000,
      idle: 5000,
    },
    retry: { max: 3 },
    timezone: "+04:00",
    logging: false,
    dialectOptions: {
      connectTimeout: 5000,
    },
  },
);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.connect = async () => {
  try {
    await db.sequelize.authenticate();
    console.log("Connected");
  } catch (error) {
    console.error("Database Error:", error ? (error.message || error.toString()) : "Naməlum xəta");
  }
};



module.exports = db;

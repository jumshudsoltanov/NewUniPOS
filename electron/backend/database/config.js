const { Sequelize } = require("sequelize");

let db = {};

/**
 * TƏHLÜKƏSİZLİK QEYDİ
 * Baza adı/istifadəçi/parol burada açıq yazılıb və git tarixçəsinə düşüb.
 * Davranışı dəyişməmək üçün mövcud dəyərlər DEFOLT olaraq saxlanılır, lakin
 * artıq mühit dəyişənləri ilə əvəz oluna bilir. Tövsiyə: istehsalatda
 * UNIPOS_DB_PASS (və lazımsa digərlərini) mühit dəyişəni kimi verin və
 * aşağıdakı defolt paroldan imtina edin.
 */
const DB_NAME = process.env.UNIPOS_DB_NAME || "unipos-new";
const DB_USER = process.env.UNIPOS_DB_USER || "root";
const DB_PASS =
  process.env.UNIPOS_DB_PASS ||
  "$2a$12$9IuwxtJ27i1RGqV/3m/OB.Lr2tilbrHvVPHUv06MmTMwDSwHTExW.";
const DB_HOST = process.env.UNIPOS_DB_HOST || "localhost";
const DB_PORT = Number(process.env.UNIPOS_DB_PORT) || 3306;

const sequelize = new Sequelize(
  DB_NAME,
  DB_USER,
  DB_PASS,
  {
    host: DB_HOST,
    dialect: "mariadb",
    port: DB_PORT,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
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
    console.error(
      "Database Error:",
      error ? error.message || error.toString() : "Naməlum xəta",
    );
  }
};

module.exports = db;

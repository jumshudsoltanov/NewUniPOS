const { QueryTypes } = require("sequelize");
const db = require("../database/config");
const whatsappConfig = require("../bot/whatsapp/whatsappConfig");

/**
 * Cari MariaDB/MySQL verilənlər bazasındakı bütün cədvəlləri TRUNCATE edir (lokal POS məlumatı).
 * Sequelize 6: `query()` üçün `type` verilməsə DEFAULT RAW olur; MariaDB dialect `delete data.meta`
 * massivdə çökür — SELECT üçün QueryTypes.SELECT, SET/TRUNCATE üçün QueryTypes.UPDATE istifadə edirik.
 */
const resetLocalDatabase = async (req, res) => {
  try {
    const dialect = db.sequelize.getDialect();
    if (dialect !== "mariadb" && dialect !== "mysql") {
      return res.status(400).json({
        ok: false,
        message: "Yalnız MariaDB/MySQL üçün dəstəklənir",
      });
    }

    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", {
      type: QueryTypes.UPDATE,
    });

    const rows = await db.sequelize.query(
      `SELECT TABLE_NAME AS tbl_name FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
      { type: QueryTypes.SELECT },
    );

    const tableList = Array.isArray(rows) ? rows : [];

    for (const row of tableList) {
      const rawName = row.tbl_name ?? row.TBL_NAME ?? row.name ?? row.NAME;
      if (!rawName || typeof rawName !== "string") continue;
      const safe = rawName.replace(/`/g, "``");
      await db.sequelize.query(`TRUNCATE TABLE \`${safe}\``, {
        type: QueryTypes.UPDATE,
      });
    }

    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", {
      type: QueryTypes.UPDATE,
    });

    return res.json({
      ok: true,
      message: "Lokal verilənlər bazası sıfırlandı",
    });
  } catch (err) {
    console.error("[admin] resetLocalDatabase:", err);
    try {
      await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", {
        type: QueryTypes.UPDATE,
      });
    } catch (_) {
      /* ignore */
    }
    return res.status(500).json({
      ok: false,
      message: err.message || "Bazanı sıfırlama xətası",
    });
  }
};

const getWhatsappSettings = async (req, res) => {
  try {
    const config = await whatsappConfig.readConfig();
    return res.json({
      ok: true,
      denyActions: config.denyActions,
      denyPrefixes: config.denyPrefixes,
      defaultDenyActions: whatsappConfig.DEFAULT_DENY_ACTIONS,
      defaultDenyPrefixes: whatsappConfig.DEFAULT_DENY_PREFIXES,
    });
  } catch (err) {
    console.error("[admin] getWhatsappSettings:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const saveWhatsappSettings = async (req, res) => {
  try {
    const { denyActions, denyPrefixes } = req.body;
    const saved = await whatsappConfig.writeConfig({ denyActions, denyPrefixes });
    await whatsappConfig.reloadCache();
    return res.json({ ok: true, ...saved });
  } catch (err) {
    console.error("[admin] saveWhatsappSettings:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};

module.exports = {
  resetLocalDatabase,
  getWhatsappSettings,
  saveWhatsappSettings,
};

const { QueryTypes } = require("sequelize");
const db = require("../database/config");
const whatsappConfig = require("../bot/whatsapp/whatsappConfig");
const WaitersModel = require("../model/WaitersModel");
const AppSettingsModel = require("../model/AppSettingsModel");

const ALL_PERMISSIONS = {
  can_edit_all_checks: 1,
  can_edit_service_fee: 1,
  can_change_table: 1,
  can_edit_guest_count: 1,
  can_merge_checks: 1,
  can_change_sale_type: 1,
  can_change_waiter: 1,
  can_add_discount: 1,
  can_delete_product: 1,
  can_close_without_payment: 1,
  can_create_report: 1,
  can_delete_check: 1,
  can_change_product_price: 1,
  can_view_archived_checks: 1,
  can_print_before_close: 1,
  can_access_own_checks_only: 0,
  cannot_close_check: 0,
  can_lock_check: 1,
  can_access_settings: 1,
  can_add_expense: 1,
  can_give_treats: 1,
  can_give_deposit: 1,
  can_split_receipt: 1,
  can_return_receipt: 1,
  can_see_notif: 1,
  can_see_device: 1,
  can_see_tax: 1,
  can_block_customer_on_check: 1,
  can_see_total: 1,
  can_manage_packs: 1,
  require_comment_for_price_change: 0,
  can_transfer_product_between_tables: 1,
  can_view_logs: 1,
  can_view_customers: 1,
  can_clear_check: 1,
  can_add_check_comment: 1,
  can_transfer_product: 1,
  can_give_product_discount: 1,
  can_manage_products: 1,
  can_edit_table_design: 1,
  can_create_order: 1,
  can_see_shortcuts: 1,
  can_see_sale_type_queue: 1,
  can_see_shift_history: 1,
};

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

const getSystemUsers = async (req, res) => {
  try {
    const { profile_id } = req.query;
    if (!profile_id) return res.status(400).json({ ok: false, message: "profile_id tələb olunur" });
    const users = await WaitersModel.findAll({
      where: { profile_id: Number(profile_id) },
      attributes: ["id", "name", "pin", "card_id"],
    });
    return res.json({ ok: true, data: users });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const createSystemUser = async (req, res) => {
  try {
    const { profile_id, name, pin } = req.body;
    if (!profile_id || !name || !pin) {
      return res.status(400).json({ ok: false, message: "profile_id, name və pin tələb olunur" });
    }
    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ ok: false, message: "PIN 4-6 rəqəmli olmalıdır" });
    }
    const existing = await WaitersModel.findOne({ where: { profile_id: Number(profile_id), pin: String(pin) } });
    if (existing) return res.status(400).json({ ok: false, message: "Bu PIN artıq istifadə olunur" });
    const user = await WaitersModel.create({
      profile_id: Number(profile_id),
      name: String(name),
      pin: String(pin),
      username: String(name).toLowerCase().replace(/\s+/g, "_"),
      password: "0",
      card_id: "0",
      is_local: 1,
      ...ALL_PERMISSIONS,
    });
    return res.json({ ok: true, data: user });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const updateSystemUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, pin } = req.body;
    const user = await WaitersModel.findByPk(Number(id));
    if (!user) return res.status(404).json({ ok: false, message: "İstifadəçi tapılmadı" });
    const updates = { ...ALL_PERMISSIONS };
    if (name) updates.name = String(name);
    if (pin) {
      if (!/^\d{4,6}$/.test(String(pin))) {
        return res.status(400).json({ ok: false, message: "PIN 4-6 rəqəmli olmalıdır" });
      }
      const existing = await WaitersModel.findOne({ where: { profile_id: user.profile_id, pin: String(pin) } });
      if (existing && existing.id !== Number(id)) {
        return res.status(400).json({ ok: false, message: "Bu PIN artıq istifadə olunur" });
      }
      updates.pin = String(pin);
    }
    await user.update(updates);
    return res.json({ ok: true, data: user });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const deleteSystemUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await WaitersModel.findByPk(Number(id));
    if (!user) return res.status(404).json({ ok: false, message: "İstifadəçi tapılmadı" });
    await user.destroy();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const getSettingsPin = async (req, res) => {
  try {
    const row = await AppSettingsModel.findOne({ where: { key: "settings_pin" } });
    return res.json({ ok: true, pin: row?.value || "2507" });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const saveSettingsPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ ok: false, message: "PIN 4-6 rəqəmli olmalıdır" });
    }
    const [row, created] = await AppSettingsModel.findOrCreate({
      where: { key: "settings_pin" },
      defaults: { value: String(pin) },
    });
    if (!created) await row.update({ value: String(pin) });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

module.exports = {
  resetLocalDatabase,
  getWhatsappSettings,
  saveWhatsappSettings,
  getSystemUsers,
  createSystemUser,
  updateSystemUser,
  deleteSystemUser,
  getSettingsPin,
  saveSettingsPin,
};

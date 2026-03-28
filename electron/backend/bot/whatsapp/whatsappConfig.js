const AppSettingsModel = require("../../model/AppSettingsModel");

const SETTINGS_KEY = "whatsapp_config";

/** Hardcoded defaults */
const DEFAULT_DENY_ACTIONS = [
  "Sifariş göndərildi",
  "Taymer başladıldı",
  "Taymer dayandırıldı",
  "Taymer sıfırlandı",
  "Ön çap çıxarıldı",
  "Çek çap edildi",
  "Miqdar dəyişdirildi",
  "Qiymət dəyişdirildi",
  "Məhsula endirim",
  "Şərh yazıldı",
  "Məhsul qəbul edildi",
];

const DEFAULT_DENY_PREFIXES = ["Məhsul əlavə edildi", "Vergi "];

function _defaults() {
  return {
    denyActions: [...DEFAULT_DENY_ACTIONS],
    denyPrefixes: [...DEFAULT_DENY_PREFIXES],
  };
}

async function readConfig() {
  try {
    const row = await AppSettingsModel.findOne({ where: { key: SETTINGS_KEY } });
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return {
        denyActions: Array.isArray(parsed.denyActions) ? parsed.denyActions : DEFAULT_DENY_ACTIONS,
        denyPrefixes: Array.isArray(parsed.denyPrefixes) ? parsed.denyPrefixes : DEFAULT_DENY_PREFIXES,
      };
    }
  } catch (err) {
    console.error("[WhatsApp Config] readConfig DB error:", err.message);
  }
  return _defaults();
}

async function writeConfig(settings) {
  const data = {
    denyActions: Array.isArray(settings.denyActions) ? settings.denyActions : DEFAULT_DENY_ACTIONS,
    denyPrefixes: Array.isArray(settings.denyPrefixes) ? settings.denyPrefixes : DEFAULT_DENY_PREFIXES,
  };
  try {
    await AppSettingsModel.upsert({ key: SETTINGS_KEY, value: JSON.stringify(data) });
  } catch (err) {
    console.error("[WhatsApp Config] writeConfig DB error:", err.message);
  }
  return data;
}

// Sync wrapper used by Whatsapp.js hot-path — reads from DB asynchronously,
// falls back to a cached copy so callers stay non-blocking.
let _cache = null;

async function _refreshCache() {
  _cache = await readConfig();
}

// Kick off initial cache load (non-blocking)
_refreshCache().catch(() => {});

function isActionDenied(action) {
  if (!action || typeof action !== "string") return true;
  const a = action.trim();
  const config = _cache || _defaults();
  if (config.denyActions.includes(a)) return true;
  for (const prefix of config.denyPrefixes) {
    if (a.startsWith(prefix)) return true;
  }
  return false;
}

// Call after writeConfig so hot-path immediately uses new settings
async function reloadCache() {
  await _refreshCache();
}

module.exports = {
  readConfig,
  writeConfig,
  isActionDenied,
  reloadCache,
  DEFAULT_DENY_ACTIONS,
  DEFAULT_DENY_PREFIXES,
};

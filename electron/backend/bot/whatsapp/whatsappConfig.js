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
  "Qəbz kilidləndi",
  "Qəbz açıldı",
  "Çek bağlandı",
  "Ödəniş edildi",
  "Ödənişsiz bağlandı",
];

const NEWLY_ADDED_DENY_ACTIONS = [];

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
      const denyActions = Array.isArray(parsed.denyActions) ? parsed.denyActions : DEFAULT_DENY_ACTIONS;
      const denyPrefixes = Array.isArray(parsed.denyPrefixes) ? parsed.denyPrefixes : DEFAULT_DENY_PREFIXES;
      const blockEmptyCheckDelete = parsed.blockEmptyCheckDelete === true;
      // Yalnız DB-də heç olmamış yeni action-ları əlavə et
      // User-in söndürdüklərinə toxunma
      const dbSet = new Set(denyActions);
      const toAdd = NEWLY_ADDED_DENY_ACTIONS.filter(a => !dbSet.has(a));
      const merged = toAdd.length > 0 ? [...denyActions, ...toAdd] : denyActions;
      return { denyActions: merged, denyPrefixes, blockEmptyCheckDelete };
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
    blockEmptyCheckDelete: settings.blockEmptyCheckDelete === true,
  };
  const json = JSON.stringify(data);
  const existing = await AppSettingsModel.findOne({ where: { key: SETTINGS_KEY } });
  if (existing) {
    await existing.update({ value: json });
  } else {
    await AppSettingsModel.create({ key: SETTINGS_KEY, value: json });
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

function isBlockEmptyCheckDelete() {
  const config = _cache || _defaults();
  return config.blockEmptyCheckDelete === true;
}

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
  isBlockEmptyCheckDelete,
  reloadCache,
  DEFAULT_DENY_ACTIONS,
  DEFAULT_DENY_PREFIXES,
};

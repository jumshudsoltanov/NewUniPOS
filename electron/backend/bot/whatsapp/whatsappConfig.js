const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "whatsapp_settings.json");

/** Hardcoded defaults – match the original WHATSAPP_EXACT_DENY + prefix rules */
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

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        denyActions: Array.isArray(parsed.denyActions)
          ? parsed.denyActions
          : DEFAULT_DENY_ACTIONS,
        denyPrefixes: Array.isArray(parsed.denyPrefixes)
          ? parsed.denyPrefixes
          : DEFAULT_DENY_PREFIXES,
      };
    }
  } catch (err) {
    console.error("[WhatsApp Config] read error:", err.message);
  }
  return {
    denyActions: [...DEFAULT_DENY_ACTIONS],
    denyPrefixes: [...DEFAULT_DENY_PREFIXES],
  };
}

function writeConfig(settings) {
  const data = {
    denyActions: Array.isArray(settings.denyActions)
      ? settings.denyActions
      : DEFAULT_DENY_ACTIONS,
    denyPrefixes: Array.isArray(settings.denyPrefixes)
      ? settings.denyPrefixes
      : DEFAULT_DENY_PREFIXES,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
  return data;
}

function isActionDenied(action) {
  if (!action || typeof action !== "string") return true;
  const a = action.trim();
  const config = readConfig();
  if (config.denyActions.includes(a)) return true;
  for (const prefix of config.denyPrefixes) {
    if (a.startsWith(prefix)) return true;
  }
  return false;
}

module.exports = {
  readConfig,
  writeConfig,
  isActionDenied,
  DEFAULT_DENY_ACTIONS,
  DEFAULT_DENY_PREFIXES,
};

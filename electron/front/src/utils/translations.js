/**
 * ================================================================
 *   TƏRCÜMƏ SİSTEMİ — az / en / ru / tr
 *   Məlumat: translations.json (Python skripti avtomatik doldurur)
 *   İstifadə: import { t } from "../../utils/translations";
 *   Yazılış:  {t("checks")}
 *   Dil:      localStorage.getItem("language") → "az" | "en" | "ru" | "tr"
 *   Parametr: t("barcode_product_added", { name: "Cola" })
 * ================================================================
 */
import data from "./translations.json";

// t() tətbiqdə yüzlərlə yerdə, hər render zamanı çağırılır — hər dəfə
// localStorage.getItem() etmək (sinxron I/O) yığılıb zəif komplarda hiss
// olunan yavaşlıq yaradır. Dil yalnız istifadəçi Settings-də dəyişdirəndə
// dəyişdiyi üçün keşləyib yalnız dəyişəndə yeniləyirik.
let cachedLang = null;

export function getCurrentLanguage() {
  if (cachedLang === null) {
    try {
      cachedLang = localStorage.getItem("language") || "az";
    } catch {
      cachedLang = "az";
    }
  }
  return cachedLang;
}

export function setCurrentLanguage(lang) {
  cachedLang = lang || "az";
  try {
    localStorage.setItem("language", cachedLang);
  } catch {
    /* ignore */
  }
}

/**
 * t("açar_adı", { param1: "dəyər" })
 *  - keşlənmiş dili istifadə edir (bax: getCurrentLanguage)
 *  - Açar tapılmasa AZ versiyası fallback olaraq göstərilir
 *  - {param} kimi yerləşdiriciləri dəyərlərlə əvəz edir
 */
export function t(key, params = {}) {
  if (!key) return "";
  const lang = getCurrentLanguage();
  let text = data[lang]?.[key] ?? data.az[key] ?? key;

  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    });
  }

  return text;
}

export default data;

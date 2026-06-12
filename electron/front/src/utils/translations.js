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

/**
 * t("açar_adı", { param1: "dəyər" })
 *  - localStorage-dan dili oxuyur
 *  - Açar tapılmasa AZ versiyası fallback olaraq göstərilir
 *  - {param} kimi yerləşdiriciləri dəyərlərlə əvəz edir
 */
export function t(key, params = {}) {
  if (!key) return "";
  const lang = localStorage.getItem("language") || "az";
  let text = data[lang]?.[key] ?? data.az[key] ?? key;

  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    });
  }

  return text;
}

export default data;

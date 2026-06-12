/**
 * Dilə əsasən pul formatı
 *
 * ₼ işarəsi HƏMİŞƏ sondadır:
 *   az: "10.50 ₼"    tr: "10,50 ₺"
 *   en: "10.50 ₼"    ru: "10,50 ₼"
 *
 * İstifadə:
 *   import { formatPrice } from "../../utils/formatPrice";
 *   {formatPrice(amount)}
 */
const localeMap = {
  az: "az-Latn-AZ",
  en: "en-US",
  ru: "ru-RU",
  tr: "tr-TR",
};

const symbolMap = {
  az: "₼",
  en: "$",
  ru: "₽",
  tr: "₺",
};

/**
 * Məbləği dilə uyğun formatla — valyuta işarəsi həmişə sonunda
 * formatPrice(10.5) -> az: "10.50 ₼", en: "10.50 $", ru: "10,50 ₽", tr: "10,50 ₺"
 */
export function formatPrice(amount) {
  if (amount == null || isNaN(amount)) return "0.00 ₼";
  const lang = localStorage.getItem("language") || "az";
  const locale = localeMap[lang] || "az-Latn-AZ";
  const sym = symbolMap[lang] || "₼";

  try {
    const num = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return num + " " + sym;
  } catch {
    return amount.toFixed(2) + " " + sym;
  }
}

/**
 * Sadəcə nömrə formatı (valyuta işarəsi olmadan)
 * formatNumber(10500.5) -> az: "10.500,50", en: "10,500.50"
 */
export function formatNumber(amount) {
  if (amount == null || isNaN(amount)) return "0";
  const lang = localStorage.getItem("language") || "az";
  const locale = localeMap[lang] || "az-Latn-AZ";
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

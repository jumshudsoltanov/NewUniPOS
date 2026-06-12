/**
 * useTranslation() hook-u
 *
 * İstifadə:
 *   import { useTranslation } from "../../hooks/useTranslation";
 *   const { t, lang, changeLanguage, languageOptions } = useTranslation();
 *   return <h1>{t("checks")}</h1>;
 *
 * Dil dəyişdirmək:
 *   changeLanguage("en")  // localStorage + state yenilənir, UI avtomatik reload olur
 *
 * Dil siyahısı:
 *   languageOptions = [
 *     { code: "az", label: "Azərbaycan" },
 *     { code: "en", label: "English" },
 *     { code: "ru", label: "Русский" },
 *     { code: "tr", label: "Türkçe" },
 *   ]
 */
import { useState, useCallback } from "react";
import { t as translate } from "../utils/translations";

export const languageOptions = [
  { code: "az", label: "Azərbaycan", flag: "🇦🇿" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
];

export function useTranslation() {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("language") || "az";
  });

  const t = useCallback(
    (key, params) => translate(key, params),
    [lang] // lang dəyişəndə yenidən render olunur
  );

  const changeLanguage = useCallback((newLang) => {
    if (!newLang) return;
    localStorage.setItem("language", newLang);
    setLang(newLang);
  }, []);

  const currentLang = languageOptions.find((l) => l.code === lang);

  return {
    t,
    lang,
    changeLanguage,
    languageOptions,
    currentLang,
  };
}

export default useTranslation;

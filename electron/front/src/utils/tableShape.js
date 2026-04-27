/**
 * Masa forması — admin API / sync sətri fərqli ola bilər; UI sinifləri həmişə eyni olsun.
 * Bilyar üçün "bilyard", "pool" və s. → "billiard"
 */
export const normalizeTableShape = (raw) => {
  const s = String(raw == null || raw === "" ? "square" : raw)
    .trim()
    .toLowerCase();
  if (s === "billiard" || s === "bilyard" || s === "pool" || s === "snooker") {
    return "billiard";
  }
  if (s === "square" || s === "round" || s === "rectangle") {
    return s;
  }
  return "square";
};

export const isBilliardTableShape = (raw) => normalizeTableShape(raw) === "billiard";

export function normalizeCardId(value) {
  return String(value ?? "").replace(/\D/g, "");
}

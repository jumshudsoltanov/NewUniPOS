function normalizeDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

module.exports = { normalizeDigits };

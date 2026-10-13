/**
 * YARADILMAZDAN ƏVVƏL SİLİNƏN ÇEKLƏR
 * ==================================
 * Masa açılanda sifariş frontend-də dərhal göstərilir, serverə isə fonda yazılır
 * (~0.5 s). Kassir bu arada "Çeki ləğv et" basa bilər: silmə sorğusu serverə
 * yaratma sorğusundan ƏVVƏL çatır, çek tapılmır, sonra yaratma bitir və masa
 * yenidən dolu görünür ("silinmir / gec silinir" təəssüratı).
 *
 * Həll: silinmək istənən, amma hələ mövcud olmayan uuid qısa müddət yadda
 * saxlanılır. Yaratma sorğusu həmin uuid ilə gələndə çek birbaşa silinmiş
 * (status 3) kimi yazılır.
 */
const TTL_MS = 5 * 60 * 1000;
const marks = new Map(); // uuid -> { at, reason }

function cleanup() {
  const now = Date.now();
  for (const [uuid, m] of marks) {
    if (now - m.at > TTL_MS) marks.delete(uuid);
  }
}

function mark(uuid, reason = null) {
  if (!uuid) return;
  cleanup();
  marks.set(String(uuid), { at: Date.now(), reason });
}

/** Qeyd varsa onu qaytarır və silir */
function consume(uuid) {
  if (!uuid) return null;
  const m = marks.get(String(uuid));
  if (!m) return null;
  marks.delete(String(uuid));
  if (Date.now() - m.at > TTL_MS) return null;
  return m;
}

module.exports = { mark, consume };

/**
 * Çek redaktəyə bağlı: yalnız DB `is_locked === 1`.
 * Müştəri çekindən sonra blok: `can_block_customer_on_check` + uğurlu çap → serverdə `is_locked` təyin olunur;
 * açmaq üçün kilid modalından «Kilidi aç».
 */
export function isOrderEditLocked(order) {
  if (!order) return false;
  return Number(order.is_locked) === 1;
}

export function orderEditLockedToast() {
  return "Qəbz kilidlidir!";
}

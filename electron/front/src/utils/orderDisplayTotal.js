import { getEffectiveHourlyPrice } from "./orderHourlyPrice";
import { sumOrderItemsLinesTotal } from "./orderItemLineTotal";

/** Məhsul sətirləri (modifikatorlar daxil) + taymer məbləği (endirim/xidmətdən əvvəl). */
export function getOrderItemsAndTimerSubtotal(order, tableHourlyFallback) {
  if (!order) return 0;

  const hourlyFromTable = order?.table?.hourly_price ?? tableHourlyFallback;
  const orderForHourly = {
    ...order,
    table: { ...(order.table || {}), hourly_price: hourlyFromTable },
    orders_items: order.orders_items || [],
  };
  const effHourly = getEffectiveHourlyPrice(orderForHourly);

  let itemsBase = 0;
  if (order.orders_items && order.orders_items.length > 0) {
    itemsBase = sumOrderItemsLinesTotal(order.orders_items, order);
  } else {
    const amt = Number(order.amount || 0);
    const rate = Number(order.rate_per_minute || 0);
    itemsBase = rate > 0 ? Math.max(0, amt - rate) : amt;
  }

  // Məhsul taymerləri (product_type==='timer') varsa, onların ödənişi artıq sumOrderItemsLinesTotal içindədir.
  // rate_per_minute isə masa saatlığıdır — yalnız product timer yoxdursa əlavə olunur.
  const hasProductTimer = (order.orders_items || []).some(it => {
    const pt = String(it.product_type || it.product?.product_type || '').toLowerCase();
    return pt === 'timer' || !!(it.timer_intervals || it.product?.timer_intervals);
  });

  let timerCharge = hasProductTimer ? 0 : Number(order.rate_per_minute || 0);
  
  if (
    timerCharge === 0 &&
    !hasProductTimer &&
    order.is_timer_clock &&
    order.is_timer_clock !== "00:00:00" &&
    effHourly > 0
  ) {
    const parts = String(order.is_timer_clock).split(":").map(Number);
    if (parts.length === 3) {
      const totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      timerCharge = (effHourly / 3600) * totalSeconds;
    }
  }

  return itemsBase + timerCharge;
}

/**
 * Masa kartı və çek siyahısı: CheckBottom yadda saxlanmış sətirlər + modifikatorlar + taymer + endirim/xidmət.
 * @param {object} order
 * @param {number} [tableHourlyFallback] — masa obyektində hourly yoxdursa (TablesSlice)
 */
export function computeOrderCardMeta(order, tableHourlyFallback) {
  if (!order) return { displayAmount: 0, isDepositFloor: false };

  const discount = Number(order.discount || 0);
  const deposit = Number(order.deposit || 0);
  const deliveryFee = Number(order.delivery_fee || 0);

  const gross = getOrderItemsAndTimerSubtotal(order, tableHourlyFallback);
  const subtotalAfterDiscount = gross - discount;

  // Service charge: CheckBottom ilə eyni məntiq (service_value % × base items)
  let serviceAmount = 0;
  const serviceValueRaw = order.service_value;
  const hasExplicitServiceValue = serviceValueRaw !== null && serviceValueRaw !== undefined;
  const serviceValue = Number(serviceValueRaw || 0);
  const serviceType = order.service_type || "percent";

  if (serviceValue > 0) {
    // Servis yalnız base qiymətlərdən (taymer xarici, no_service_fee xarici) hesablanır
    let totalForService = 0;
    (order.orders_items || []).forEach(item => {
      const isNoService = Number(item.no_service_fee) === 1 || Number(item.product?.no_service_fee) === 1;
      if (!isNoService) {
        const count = Number(item.count || item.quantity || 0);
        const price = Number(item.price || item.amount || 0);
        let modsTotal = 0;
        try {
          const mods = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : (item.modifiers || []);
          modsTotal = mods.reduce((s, m) => s + Number(m.price || 0) * Number(m.count || 1), 0);
        } catch { /* ignore */ }
        totalForService += count * (price + modsTotal);
      }
    });
    if (serviceType === "percent") {
      serviceAmount = (totalForService * serviceValue) / 100;
    } else {
      serviceAmount = serviceValue;
    }
  }

  // Fallback: saved service_charge field-ı istifadə et
  if (serviceAmount === 0 && Number(order.service_charge) > 0) {
    serviceAmount = Number(order.service_charge);
  }

  const displayAmount = Math.max(subtotalAfterDiscount, deposit) + serviceAmount + deliveryFee;
  const isDepositFloor = deposit > subtotalAfterDiscount;
  return { displayAmount, isDepositFloor };
}

export function computeOrderCardDisplayAmount(order, tableHourlyFallback) {
  return computeOrderCardMeta(order, tableHourlyFallback).displayAmount;
}

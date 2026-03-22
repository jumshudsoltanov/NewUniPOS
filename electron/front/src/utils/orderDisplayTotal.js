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
    itemsBase = sumOrderItemsLinesTotal(order.orders_items);
  } else {
    const amt = Number(order.amount || 0);
    const rate = Number(order.rate_per_minute || 0);
    itemsBase = rate > 0 ? Math.max(0, amt - rate) : amt;
  }

  let timerCharge = Number(order.rate_per_minute || 0);
  if (
    timerCharge === 0 &&
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
  const service = Number(order.service_charge || 0);
  const deliveryFee = Number(order.delivery_fee || 0);

  const gross = getOrderItemsAndTimerSubtotal(order, tableHourlyFallback);
  const subtotalAfterDiscount = gross - discount;
  const displayAmount = Math.max(subtotalAfterDiscount, deposit) + service + deliveryFee;
  const isDepositFloor = deposit > subtotalAfterDiscount;
  return { displayAmount, isDepositFloor };
}

export function computeOrderCardDisplayAmount(order, tableHourlyFallback) {
  return computeOrderCardMeta(order, tableHourlyFallback).displayAmount;
}

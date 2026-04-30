/**
 * CheckBottom.jsx ilə eyni: kombo/modifikator qiymətləri sətir cəminə daxil edilir.
 * Masa kartı və çek modalları bu util ilə çek içi cəmlə uyğunlaşır.
 */
export function getModifiersTotalPerUnit(item) {
  let modifiersTotal = 0;
  try {
    let mods = item?.modifiers;
    if (typeof mods === "string") mods = JSON.parse(mods);
    if (Array.isArray(mods)) {
      modifiersTotal = mods.reduce(
        (sum, mod) => sum + Number(mod.price || 0) * Number(mod.count || 1),
        0,
      );
    }
  } catch {
    /* ignore */
  }
  return modifiersTotal;
}

/** Bir orders_items sətri: say × (vahid qiymət + modifikatorlar vahidə) */
export function getOrderItemLineTotal(item) {
  const count = Number(item.count || item.quantity || 0);
  const price = Number(item.price || item.amount || 0);
  return count * (price + getModifiersTotalPerUnit(item));
}

/** Yadda saxlanmış sətirlərin məhsul üzrə cəmi (endirim/xidmət daxil deyil) */
export function sumOrderItemsLinesTotal(ordersItems) {
  if (!ordersItems || !ordersItems.length) return 0;
  return ordersItems.reduce((sum, it) => sum + getOrderItemLineTotal(it), 0);
}

/**
 * Ödəniş tipini normallaşdır: "Nağd"/"Nağdsız" birinci prioritet;
 * type sahəsi əsas götürülür, ad isə yalnız fallback kimi istifadə olunur.
 */
function _normPayType(s) {
  if (s == null || s === "") return "";
  return String(s)
    .normalize("NFC")
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .trim();
}

/**
 * Sifariş ödənişi → fiskal API üçün.
 * Prioritet: type sahəsi → ad sahəsi.
 * "Nağd" = cash, "Nağdsız" = cashless (card).
 */
export function mapOrderPaymentForTax(p) {
  if (p == null) {
    return { name: "Nağd", type: "cash", amount: 0 };
  }
  const safeStr = (v) => (v == null ? "" : String(v));
  const name = String(
    p?.payment_method?.name != null
      ? safeStr(p.payment_method.name)
      : p?.tag?.name != null
        ? safeStr(p.tag.name)
        : p?.name != null
          ? safeStr(p.name)
          : "",
  ).trim();
  const n = _normPayType(name);
  const typeRaw =
    p?.payment_method?.type != null ? p.payment_method.type : p?.type;
  const t = _normPayType(typeRaw != null && typeRaw !== "" ? typeRaw : "");
  const amount = Number(p.paid != null ? p.paid : p.amount) || 0;

  let outType = "cash";

  // ── 1. TYPE sahəsi əsasında (ən etibarlı mənbə) ──────────────────────────
  if (t === "nagd" || t === "negd" || t === "cash") {
    // "Nağd" → nağd
    outType = "cash";
  } else if (
    t === "nagdsiz" || t === "negdsiz" ||
    t === "cashless" || t === "card" || t === "bank" ||
    t === "pos" || t === "terminal" || t === "kart" || t === "kredit"
  ) {
    // "Nağdsız" / card / bank / pos → nağdsız
    outType = t === "kredit" ? "kredit" : "nagdsiz";
  }

  // ── 2. AD sahəsi əsasında (type boş və ya tanınmırsa) ───────────────────
  else if (n.includes("nagdsiz") || n.includes("negdsiz")) {
    outType = "nagdsiz";
  } else if (
    n.includes("kart") || n.includes("visa") || n.includes("mastercard") ||
    n.includes("master") || n.includes("mir") || n.includes("ameria") ||
    n.includes("pos") || n.includes("terminal") || n.includes("kart")
  ) {
    outType = "nagdsiz";
  } else if (n.includes("kredit") && !/kart|pos|terminal/i.test(n)) {
    outType = "kredit";
  } else {
    // boş və ya tanınmayan → nağd (default)
    outType = "cash";
  }

  const displayName = name || (outType === "nagdsiz" ? "Nağdsız" : outType === "kredit" ? "Kredit" : "Nağd");
  return {
    payment_method_id: p.payment_method_id,
    without_payment_method_id: p.without_payment_method_id,
    name: displayName,
    type: outType,
    amount,
  };
}

/**
 * CheckOver calcTotal ilə eyni: endirim, xidmət, yekun (fiskal / geri qaytarma).
 */
export function computeFiscalCheckTotalsFromOrder(order) {
  if (!order) {
    return {
      sumTotal: 0,
      discountAmount: 0,
      serviceAmount: 0,
      deliveryFee: 0,
    };
  }
  let total = 0;
  let totalForService = 0;
  (order.orders_items || []).forEach((item) => {
    const count = Number(item.count || item.quantity || 0);
    const price = Number(item.price || 0);
    const modifiersPerUnit = getModifiersTotalPerUnit(item);
    const itemTotal = count * (price + modifiersPerUnit);
    total += itemTotal;
    const isNoService = item.no_service_fee === 1 || item.product?.no_service_fee === 1;
    if (!isNoService) {
      totalForService += itemTotal;
    }
  });
  if (order.rate_per_minute) {
    total += Number(order.rate_per_minute);
  }
  const discountValue = Number(order.discount_value || 0);
  const discountType = order.discount_type || "percent";
  let discountAmount = 0;
  if (discountValue > 0) {
    if (discountType === "percent") {
      discountAmount = (total * discountValue) / 100;
    } else {
      discountAmount = discountValue;
    }
  } else if (order.discount) {
    discountAmount = Number(order.discount);
  }
  let serviceValue = Number(order.service_value || 0);
  const serviceType = order.service_type || "percent";
  let serviceAmount = 0;
  if (serviceValue > 0) {
    if (serviceType === "percent") {
      serviceAmount = (totalForService * serviceValue) / 100;
    } else {
      serviceAmount = serviceValue;
    }
  } else if (order.service_charge) {
    serviceAmount = Number(order.service_charge);
  }
  const depositAmount = Number(order.deposit || 0);
  const deliveryFee = Number(order.delivery_fee || 0);
  const baseTotal = total - discountAmount + serviceAmount;
  let sumTotal = Math.max(baseTotal, depositAmount) + deliveryFee;
  if (sumTotal < 0) sumTotal = 0;
  return {
    sumTotal,
    discountAmount,
    serviceAmount,
    deliveryFee,
  };
}

/**
 * Fiskal sale/moneyback üçün sətirlər: vahid qiymət = məhsul + modifikator (CheckOver sale ilə eyni).
 */
export function buildFiscalLineItemsFromOrderItems(order) {
  return (order?.orders_items || [])
    .filter((item) => Number(item.count ?? item.quantity ?? 0) > 0)
    .map((item) => {
      const unitBase = Number(item.price || 0);
      const unitWithMods = unitBase + getModifiersTotalPerUnit(item);
      return {
        ...item,
        name: item.product?.name || item.name || "Məhsul",
        count: Number(item.count ?? item.quantity ?? 1),
        price: unitWithMods,
      };
    });
}

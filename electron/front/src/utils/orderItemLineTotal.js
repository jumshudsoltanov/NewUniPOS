/**
 * CheckBottom.jsx ilə eyni: kombo/modifikator qiymətləri sətir cəminə daxil edilir.
 * Masa kartı və çek modalları bu util ilə çek içi cəmlə uyğunlaşır.
 */

let globalMenuDataLineTotal = [];
export const setMenuDataForLineTotals = (data) => {
    if (data && Array.isArray(data)) globalMenuDataLineTotal = data;
};

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

/**
 * Taymer məhsulunun elapsed dəqiqəsini hesabla.
 * Item-in özünün localAddedAt-ı varsa onu, yoxsa order.created_at-dan is_timer_clock-u istifadə edir.
 */
export function getTimerElapsedSeconds(item, order) {
  if (!item) return 0;
  let isTimerItem = String(item.product_type || '').toLowerCase() === 'timer' || String(item.product?.product_type || '').toLowerCase() === 'timer';
  const checkIntervals = (val) => {
      if (!val) return false;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === "" || trimmed === "[]" || trimmed === "null" || trimmed === "undefined" || trimmed === "0") return false;
          try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed.length > 0;
          } catch(e) {}
      }
      return false;
  };
  let hasInt = checkIntervals(item.timer_intervals) || checkIntervals(item.product?.timer_intervals);
  let hasHourly = Number(item.hourly_price || item.product?.hourly_price || 0) > 0;

  if ((!isTimerItem || !hasInt) && globalMenuDataLineTotal.length > 0) {
      const catItem = globalMenuDataLineTotal.find(m => Number(m.id) === Number(item.product_id || item.id));
      if (catItem) {
          if (!isTimerItem) isTimerItem = String(catItem.product_type || '').toLowerCase() === 'timer';
          // `!!` yoxlaması boş `"[]"` mətnini də doğru sayırdı — yuxarıdakı
          // düzgün parse edən `checkIntervals` işlədilir
          if (!hasInt) hasInt = checkIntervals(catItem.timer_intervals);
          if (!hasHourly) hasHourly = Number(catItem.hourly_price || 0) > 0;
      }
  }

  if (!isTimerItem && !hasInt && !hasHourly) return 0;

    let isTimerStatus = item.is_timer_status;
    let timerClockStr = item.is_timer_clock;
    let timerLastStartedAt = item.timer_last_started_at;

    // Fallback for older orders without item-level fields
    // If it's a newly added local item (not yet sent to DB), timerClockStr is strictly undefined.
    if (timerClockStr === undefined) {
      return 0; // Unsent items always start at 0
    }

    // ONLY fallback to order level if the item has a null clock string (old DB record).
    // If the item has a clock string (even "00:00:00"), it means it is a new item with its own timer state.
    if (timerClockStr === null || timerClockStr === "") {
      if (order && order.is_timer_clock && order.is_timer_clock !== '00:00:00') {
        const parts = String(order.is_timer_clock).split(':').map(Number);
        let orderElapsedSeconds = 0;
        if (parts.length === 3) {
          orderElapsedSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        const itemCreated = item.created_at || item.createdAt;
        const orderCreated = order.created_at || order.createdAt;
        if (itemCreated && orderCreated) {
          const itemMs = new Date(itemCreated).getTime();
          const orderMs = new Date(orderCreated).getTime();
          if (!Number.isNaN(itemMs) && !Number.isNaN(orderMs) && itemMs > orderMs) {
            const offsetSeconds = Math.floor((itemMs - orderMs) / 1000);
            return Math.max(0, orderElapsedSeconds - offsetSeconds);
          }
        }
        return orderElapsedSeconds;
      }
      return 0;
    }

    // New item-level logic
    let itemElapsedSeconds = 0;
    if (timerClockStr && String(timerClockStr).includes(':')) {
      const parts = String(timerClockStr).split(':').map(Number);
      if (parts.length === 3) {
        itemElapsedSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    } else {
      itemElapsedSeconds = parseInt(timerClockStr || "0", 10);
    }

    // Only calculate diff if the timer is actively running
    if (Number(isTimerStatus) === 1 && timerLastStartedAt) {
      const lastStarted = new Date(timerLastStartedAt).getTime();
      let endTime = Date.now();
      
      // If order is closed (2) or deleted (3), stop the timer at the end_date or updated_at
      if (order && Number(order.status) !== 1) {
        const orderEnd = order.end_date || order.endDate || order.updated_at || order.updatedAt;
        if (orderEnd) {
          const parsedEnd = new Date(orderEnd).getTime();
          if (!Number.isNaN(parsedEnd) && parsedEnd > lastStarted) {
            endTime = parsedEnd;
          }
        }
      }
      
      const diffSeconds = Math.max(0, Math.floor((endTime - lastStarted) / 1000));
      itemElapsedSeconds += diffSeconds;
    }

    return itemElapsedSeconds;
}

export function getTimerElapsedMinutes(item, order) {
  const seconds = getTimerElapsedSeconds(item, order);
  return Math.max(1, Math.ceil(seconds / 60));
}

/**


/**
 * Check if the order has any timer products with are_orders_included === 1
 */
export function hasFreeOrdersIncluded(order) {
  if (!order || !order.orders_items) return false;
  return order.orders_items.some(item => {
    const isTimer = String(item.product_type || '').toLowerCase() === 'timer' || String(item.product?.product_type || '').toLowerCase() === 'timer';
    if (!isTimer) return false;
    return Number(item.are_orders_included) === 1 || Number(item.product?.are_orders_included) === 1;
  });
}

/**
 * Taymer məhsulunun interval qiymətini hesabla:
 *   base_price + interval_charges(elapsed_minutes)
 * interval_charges: hər interval üçün Math.ceil(dəqiqə / duration) × price
 */
export function computeTimerItemTotal(item, order) {
  if (!item) return 0;
  const count = Number(item.count || item.quantity || 0);
  // base qiymət: item.price → item.amount → item.product.price
  const basePrice = Number(item.price || item.amount || item.product?.price || 0);
  const modsPerUnit = getModifiersTotalPerUnit(item);

  const seconds = getTimerElapsedSeconds(item, order);
  const elapsedMinutesCeil = Math.max(1, Math.ceil(seconds / 60));
  const elapsedMinutesFloor = Math.floor(seconds / 60);

  let intervals = item.timer_intervals || item.product?.timer_intervals;
  
  if (!intervals && globalMenuDataLineTotal.length > 0) {
      const catItem = globalMenuDataLineTotal.find(m => Number(m.id) === Number(item.product_id || item.id));
      if (catItem) {
          intervals = catItem.timer_intervals;
      }
  }

  while (typeof intervals === 'string') {
    try {
      intervals = JSON.parse(intervals);
    } catch (e) {
      intervals = null;
      break;
    }
  }

  if (intervals && typeof intervals === 'object' && !Array.isArray(intervals)) {
    intervals = Object.values(intervals);
  }

  if (!intervals || !Array.isArray(intervals) || intervals.length === 0) {
    // interval yoxdursa saatlıq qiymətlə hesabla
    let hp = Number(item.product?.hourly_price || item.hourly_price || 0);
    if (hp === 0 && globalMenuDataLineTotal.length > 0) {
      const catItem = globalMenuDataLineTotal.find(m => Number(m.id) === Number(item.product_id || item.id));
      if (catItem) {
        hp = Number(catItem.hourly_price || 0);
      }
    }
    const timerCharge = Math.ceil(elapsedMinutesCeil / 60) * hp;
    return count * (basePrice + timerCharge + modsPerUnit);
  }

  // Interval üçün istifadə olunacaq qiymət (hər interval üçün əlavə ediləcək məbləğ):
  // hourly_price - intervalın özündəki 'price' orijinal məhsul qiymətidir, ödəniş deyil!
  let intervalHourlyPrice = Number(item.product?.hourly_price || item.hourly_price || 0);
  if (intervalHourlyPrice === 0 && globalMenuDataLineTotal.length > 0) {
    const catItem = globalMenuDataLineTotal.find(m => Number(m.id) === Number(item.product_id || item.id));
    if (catItem) {
      intervalHourlyPrice = Number(catItem.hourly_price || 0);
    }
  }

  // intervalları "after" ə görə sırala
  const sorted = [...intervals].sort((a, b) => (Number(a.after) || 0) - (Number(b.after) || 0));

  let intervalCharge = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const after = Number(cur.after) || 0;
    const duration = Math.max(1, Number(cur.duration) || 1);
    // cur.price = orijinal məhsul qiymətidir, intervalın ödəniş məbləği hourly_price-dir
    const chargePerInterval = intervalHourlyPrice;

    if (elapsedMinutesFloor < after) continue; // bu intervala hələ çatılmayıb

    const maxMins = next ? (Number(next.after) || 0) - after : Infinity;
    const minsInInterval = Math.min(elapsedMinutesFloor - after, maxMins);
    // after-ə çatdıqda dərhal 1 period hesablanır, sonra hər duration-da +1
    const periodsCharged = Math.floor(minsInInterval / duration) + 1;
    intervalCharge += periodsCharged * chargePerInterval;
  }

  return count * (basePrice + intervalCharge + modsPerUnit);
}

export const checkIntervals = (val) => {
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    
    let parsed = val;
    while (typeof parsed === 'string') {
        const trimmed = parsed.trim();
        if (trimmed === "" || trimmed === "[]" || trimmed === "null" || trimmed === "undefined" || trimmed === "0") return false;
        try {
            parsed = JSON.parse(trimmed);
        } catch(e) {
            return false;
        }
    }
    
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0;
    
    return false;
};

export function isTimerItem(item, menuData = []) {
    if (!item) return false;
    
    // Check if hourly_price > 0
    let isHourly = Number(item.hourly_price || 0) > 0 || Number(item.product?.hourly_price || 0) > 0;
    
    let hasIntervals = checkIntervals(item.timer_intervals) || checkIntervals(item.product?.timer_intervals);
    
    if (!hasIntervals && menuData.length > 0) {
        const catItem = menuData.find(m => Number(m.id) === Number(item.product_id || item.id));
        if (catItem) {
            hasIntervals = !!catItem.timer_intervals;
            if (Number(catItem.hourly_price || 0) > 0) {
                isHourly = true;
            }
        }
    }

    let isTimer = String(item.product_type || '').toLowerCase() === 'timer' || String(item.product?.product_type || '').toLowerCase() === 'timer' || hasIntervals || isHourly;
    
    if (!isTimer && menuData.length > 0) {
        const catItem = menuData.find(m => Number(m.id) === Number(item.product_id || item.id));
        if (catItem) {
            isTimer = String(catItem.product_type || '').toLowerCase() === 'timer' || !!catItem.timer_intervals || Number(catItem.hourly_price || 0) > 0;
        }
    }
    return isTimer;
}

/** Bir orders_items sətri: say × (vahid qiymət + modifikatorlar vahidə) */
export function getOrderItemLineTotal(item, order = null) {
  const isTimer = isTimerItem(item, globalMenuDataLineTotal);

  if (isTimer && order) {
    return computeTimerItemTotal(item, order);
  }
  const count = Number(item.count || item.quantity || 0);
  const price = Number(item.price || item.amount || 0);
  return count * (price + getModifiersTotalPerUnit(item));
}

/** Yadda saxlanmış sətirlərin məhsul üzrə cəmi (endirim/xidmət daxil deyil) */
export function sumOrderItemsLinesTotal(ordersItems, order = null) {
  if (!ordersItems || !ordersItems.length) return 0;
  const areOrdersFree = order ? hasFreeOrdersIncluded(order) : false;
  return ordersItems.reduce((sum, it) => {
    const isTimer = isTimerItem(it, globalMenuDataLineTotal);
    let lineTotal = getOrderItemLineTotal(it, order);
    if (areOrdersFree && !isTimer) {
      lineTotal = 0;
    }
    return sum + lineTotal;
  }, 0);
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
    return { name: "Nağd", type: "cash", amount: 0, isCashless: false };
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

  const cashlessTerms = [
    "nagdsiz", "negdsiz", "cashless", "card", "kart", "bank",
    "pos", "terminal", "m10", "birbank", "birkart", "tamkart",
    "pulpal", "payriff", "wolt", "bolt", "online", "kocurme",
    "qeyri-nagd", "qeyri-negd", "hesab", "kapital", "pasha", "leobank"
  ];

  let isCashless = false;
  let isCredit = false;

  if (t === "kredit" || t === "credit" || (n.includes("kredit") && !/kart|pos|terminal/i.test(n))) {
    isCredit = true;
  } else if (cashlessTerms.some(term => t === term || t.includes(term) || n.includes(term))) {
    isCashless = true;
  } else if (t === "nagd" || t === "negd" || t === "cash" || n === "nagd" || n === "cash") {
    isCashless = false;
  } else {
    isCashless = false;
  }

  const outType = isCredit ? "kredit" : isCashless ? "nagdsiz" : "cash";
  const displayName = name || (outType === "nagdsiz" ? "Nağdsız" : outType === "kredit" ? "Kredit" : "Nağd");

  return {
    payment_method_id: p.payment_method_id,
    without_payment_method_id: p.without_payment_method_id,
    name: displayName,
    type: outType,
    amount,
    isCashless: outType === "nagdsiz",
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
  const areOrdersFree = hasFreeOrdersIncluded(order);

  (order.orders_items || []).forEach((item) => {
    const isTimer = String(item.product_type || '').toLowerCase() === 'timer' || String(item.product?.product_type || '').toLowerCase() === 'timer';
    
    let itemTotal = getOrderItemLineTotal(item, order);
    
    if (areOrdersFree && !isTimer) {
      itemTotal = 0;
    }

    total += itemTotal;
    const isNoService = item.no_service_fee === 1 || item.product?.no_service_fee === 1;
    if (!isNoService && (!areOrdersFree || isTimer)) {
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

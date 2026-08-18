/**
 * Front CheckBottom / orderItemLineTotal.js ilə eyni: sətir = say × (vahid qiymət + modifikatorlar vahidə).
 * Backend-də amount/total və servis faizi bazası bu cür hesablanmalıdır.
 */

function parseModifiersList(mods) {
  if (!mods) return [];
  if (Array.isArray(mods)) return mods;
  if (typeof mods === "string") {
    try {
      const p = JSON.parse(mods || "[]");
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function modifiersTotalPerUnit(mods) {
  return parseModifiersList(mods).reduce(
    (s, m) => s + parseFloat(m.price || 0) * parseFloat(m.count || 1),
    0,
  );
}

/**
 * @param {object} item — Sequelize instance və ya plain { count, price, modifiers }
 */
function orderItemLineTotal(item) {
  let count;
  let price;
  let modifiers;
  if (item && typeof item.get === "function") {
    count = parseFloat(item.get("count")) || 0;
    price = parseFloat(item.get("price")) || 0;
    modifiers = item.get("modifiers");
  } else {
    count = parseFloat(item.count) || 0;
    price = parseFloat(item.price) || 0;
    modifiers = item.modifiers;
  }
  let product_type = "";
  let timer_intervals = null;
  if (item && typeof item.get === "function") {
    product_type = item.get("product_type") || (item.product && item.product.product_type) || "";
    timer_intervals = item.get("timer_intervals") || (item.product && item.product.timer_intervals) || null;
  } else {
    product_type = item.product_type || item.product?.product_type || "";
    timer_intervals = item.timer_intervals || item.product?.timer_intervals || null;
  }

  const isTimer = String(product_type).toLowerCase() === 'timer';
  let hasIntervals = false;
  if (isTimer && timer_intervals) {
     let intervals = timer_intervals;
     while (typeof intervals === 'string') {
        try { intervals = JSON.parse(intervals); } catch (e) { intervals = null; break; }
     }
     if (intervals && Array.isArray(intervals) && intervals.length > 0) hasIntervals = true;
  }

  // Intervallı taymerlər üçün bütün məbləğ intervallardan (rate_per_minute) gəldiyi üçün 
  // baza qiyməti sıfırlanmalıdır, əks halda ikiqat hesablanacaq.
  if (hasIntervals) {
    price = 0;
  }

  return count * (price + modifiersTotalPerUnit(modifiers));
}

/**
 * Check if the order items have any timer products with are_orders_included === 1
 */
function hasFreeOrdersIncluded(items) {
  if (!items || !items.length) return false;
  return items.some(item => {
    let product_type = "";
    let are_orders_included = 0;
    
    if (item && typeof item.get === "function") {
      product_type = item.get("product_type") || (item.product && item.product.product_type) || "";
      are_orders_included = item.get("are_orders_included") || (item.product && item.product.are_orders_included) || 0;
    } else {
      product_type = item.product_type || item.product?.product_type || "";
      are_orders_included = item.are_orders_included || item.product?.are_orders_included || 0;
    }
    
    const isTimer = String(product_type).toLowerCase() === 'timer';
    if (!isTimer) return false;
    return Number(are_orders_included) === 1;
  });
}

function sumOrderItemsLineTotal(items) {
  if (!items || !items.length) return 0;
  const areOrdersFree = hasFreeOrdersIncluded(items);
  
  return items.reduce((sum, it) => {
    let product_type = "";
    if (it && typeof it.get === "function") {
      product_type = it.get("product_type") || (it.product && it.product.product_type) || "";
    } else {
      product_type = it.product_type || it.product?.product_type || "";
    }
    const isTimer = String(product_type).toLowerCase() === 'timer';
    
    let lineTotal = orderItemLineTotal(it);
    if (areOrdersFree && !isTimer) {
      lineTotal = 0;
    }
    return sum + lineTotal;
  }, 0);
}

module.exports = {
  orderItemLineTotal,
  sumOrderItemsLineTotal,
  modifiersTotalPerUnit,
  parseModifiersList,
};

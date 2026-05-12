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
  return count * (price + modifiersTotalPerUnit(modifiers));
}

function sumOrderItemsLineTotal(items) {
  if (!items || !items.length) return 0;
  return items.reduce((sum, it) => sum + orderItemLineTotal(it), 0);
}

module.exports = {
  orderItemLineTotal,
  sumOrderItemsLineTotal,
  modifiersTotalPerUnit,
  parseModifiersList,
};

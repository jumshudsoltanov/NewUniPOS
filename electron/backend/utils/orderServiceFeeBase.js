/**
 * Zal üzrə faiz servis haqqı yalnız "servis hesablanan" məhsul sətirlərinə tətbiq olunur.
 * products.no_service_fee === 1 olanlar xaric (front CheckBottom ilə uyğun).
 */

function getCountPrice(item) {
  if (item && typeof item.get === "function") {
    return {
      count: parseFloat(item.get("count")) || 0,
      price: parseFloat(item.get("price")) || 0,
    };
  }
  return {
    count: parseFloat(item.count) || 0,
    price: parseFloat(item.price) || 0,
  };
}

function getProductNoServiceFee(item) {
  const p = item && (item.product || item.Product);
  if (!p) return 0;
  if (typeof p.get === "function") {
    return Number(p.get("no_service_fee") || 0);
  }
  if (p.dataValues && p.dataValues.no_service_fee !== undefined) {
    return Number(p.dataValues.no_service_fee || 0);
  }
  return Number(p.no_service_fee || 0);
}

function lineTotal(item) {
  const { count, price } = getCountPrice(item);
  return count * price;
}

/**
 * @param {Array} ordersItems — Sequelize instance və ya plain { count, price, product }
 * @returns {number} servis faizi üçün əsas məbləğ (taymer daxil deyil)
 */
function serviceableItemsSum(ordersItems) {
  if (!ordersItems || !ordersItems.length) return 0;
  return ordersItems.reduce((sum, it) => {
    if (getProductNoServiceFee(it) === 1) return sum;
    return sum + lineTotal(it);
  }, 0);
}

module.exports = {
  serviceableItemsSum,
  lineTotal,
  getProductNoServiceFee,
};

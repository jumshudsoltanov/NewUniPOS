// Məhsul üzrə qismən ödənişlər (order.item_payments) üçün köməkçilər

export const getItemPaymentsList = (order) =>
  Array.isArray(order?.item_payments) ? order.item_payments : [];

export const getPartialPaidTotal = (order) =>
  Math.round(
    getItemPaymentsList(order).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100,
  ) / 100;

/** { [orderItemId]: ödənilmiş say } */
export const getPaidQtyMap = (order) => {
  const map = {};
  getItemPaymentsList(order).forEach((p) => {
    const id = Number(p.order_item_id);
    map[id] = (map[id] || 0) + (parseFloat(p.qty) || 0);
  });
  return map;
};

/** Sətirin ödəniş üsulları üzrə payları: [{payment_method_id, name, amount}] (bölünmüş ödəniş dəstəyi) */
export const getItemPaymentShares = (row) => {
  let shares = null;
  try {
    shares = typeof row?.payment_splits === "string" ? JSON.parse(row.payment_splits) : row?.payment_splits;
  } catch {
    shares = null;
  }
  if (Array.isArray(shares) && shares.length > 0) return shares;
  return [
    {
      payment_method_id: row?.payment_method_id,
      name: row?.payment_name,
      amount: parseFloat(row?.amount) || 0,
    },
  ];
};

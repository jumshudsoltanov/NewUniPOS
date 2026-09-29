const crypto = require("crypto");
const { fn, col } = require("sequelize");
const OrdersModel = require("../model/OrdersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const ProductsModel = require("../model/ProductsModel");
const OrderItemPaymentsModel = require("../model/OrderItemPaymentsModel");
const { orderItemLineTotal } = require("../utils/orderItemLineTotal");

const EPS = 0.0001;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** { [orderItemId]: ödənilmiş say } */
async function getPaidQtyMap(orderUuid, transaction) {
  const rows = await OrderItemPaymentsModel.findAll({
    where: { order_id: orderUuid },
    attributes: ["order_item_id", [fn("SUM", col("qty")), "paid_qty"]],
    group: ["order_item_id"],
    raw: true,
    transaction,
  });
  const map = {};
  rows.forEach((r) => {
    map[r.order_item_id] = parseFloat(r.paid_qty) || 0;
  });
  return map;
}

async function hasItemPayments(orderUuid, transaction) {
  const c = await OrderItemPaymentsModel.count({
    where: { order_id: orderUuid },
    transaction,
  });
  return c > 0;
}

const NOT_ALLOWED_MSG =
  "Bu çekdə məhsul üzrə ödəniş var. Əvvəlcə həmin ödənişi ləğv edin.";

const getItemPayments = async (req, res) => {
  const { orderId } = req.params;
  try {
    const rows = await OrderItemPaymentsModel.findAll({
      where: { order_id: orderId },
      order: [["id", "ASC"]],
    });
    res.status(200).json({ message: "success", data: rows });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const payItems = async (req, res) => {
  const { orderId } = req.params;
  const { items, paymentMethodId, paymentName, payments, waiterId, waiterName } =
    req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Məhsul seçilməyib" });
  }
  // Bölünmüş ödəniş: payments=[{paymentMethodId, paymentName, amount}]; köhnə tək üsul da dəstəklənir
  const splitInput = Array.isArray(payments) && payments.length > 0
    ? payments
        .map((p) => ({
          payment_method_id: Number(p.paymentMethodId) || 0,
          name: p.paymentName || null,
          amount: round2(p.amount),
        }))
        .filter((p) => p.payment_method_id && p.amount > 0)
    : paymentMethodId
      ? [{ payment_method_id: Number(paymentMethodId), name: paymentName || null, amount: null }]
      : [];
  if (splitInput.length === 0) {
    return res.status(400).json({ message: "Ödəniş üsulu seçilməyib" });
  }

  try {
    const order = await OrdersModel.findOne({ where: { uuid: orderId } });
    if (!order) return res.status(404).json({ message: "Çek tapılmadı" });
    if (Number(order.status) !== 1) {
      return res.status(409).json({ message: "Çek açıq deyil" });
    }

    const dbItems = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      include: [{ model: ProductsModel, as: "product" }],
    });
    const byId = new Map(dbItems.map((it) => [Number(it.id), it]));
    const paidMap = await getPaidQtyMap(orderId);

    const batchUuid = crypto.randomUUID();
    const records = [];
    let total = 0;

    for (const req_ of items) {
      const item = byId.get(Number(req_.orderItemId));
      const qty = parseFloat(req_.qty) || 0;
      if (!item || qty <= 0) {
        return res.status(400).json({ message: "Yanlış məhsul seçimi" });
      }
      if (Number(item.is_gift) === 1) {
        return res.status(400).json({ message: "İkram məhsul ödənilmir" });
      }
      const count = parseFloat(item.count) || 0;
      const available = count - (paidMap[item.id] || 0);
      if (qty > available + EPS) {
        return res
          .status(409)
          .json({ message: "Seçilən say ödənilməmiş saydan çoxdur" });
      }
      const unit = count > 0 ? orderItemLineTotal(item) / count : 0;
      const amount = round2(unit * qty);
      total += amount;
      records.push({
        profile_id: order.profile_id,
        order_id: orderId,
        order_item_id: item.id,
        product_name: item.product?.name || null,
        qty,
        amount,
        operator_id: waiterId || null,
        operator_name: waiterName || null,
        batch_uuid: batchUuid,
      });
    }
    total = round2(total);

    // Ödəniş üsulları üzrə məbləğlər çəkiyə bərabər olmalıdır (tək üsulda avtomatik = çəki)
    if (splitInput.length === 1 && splitInput[0].amount === null) {
      splitInput[0].amount = total;
    }
    const splitSum = round2(splitInput.reduce((s2, p) => s2 + p.amount, 0));
    if (Math.abs(splitSum - total) > 0.011) {
      return res.status(400).json({
        message: `Ödəniş üsullarının cəmi (${splitSum.toFixed(2)}) seçilən məhsulların cəminə (${total.toFixed(2)}) bərabər deyil`,
      });
    }

    // Hər sətrin məbləği üsullar arasında nisbətlə bölünür (son üsul qalığı alır — yuvarlaqlaşdırma itməsin)
    const paymentName = splitInput.map((p) => p.name).filter(Boolean).join(" + ") || null;
    records.forEach((rec) => {
      let remaining = rec.amount;
      const shares = splitInput.map((p, i) => {
        const share =
          i === splitInput.length - 1
            ? round2(remaining)
            : round2(total > 0 ? (rec.amount * p.amount) / total : 0);
        remaining = round2(remaining - share);
        return { payment_method_id: p.payment_method_id, name: p.name, amount: share };
      });
      rec.payment_method_id = splitInput[0].payment_method_id;
      rec.payment_name = paymentName;
      rec.payment_splits = JSON.stringify(shares);
    });

    await OrderItemPaymentsModel.bulkCreate(records);
    await OrdersModel.update(
      { is_synced: 0 },
      { where: { uuid: orderId } },
    );

    res.status(200).json({
      message: "success",
      data: { batch_uuid: batchUuid, total, records, payments: splitInput },
    });

    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });
  } catch (e) {
    console.error("payItems error:", e);
    res.status(500).json({ message: e.message });
  }
};

const cancelItemPayment = async (req, res) => {
  const { orderId, batchUuid } = req.params;
  try {
    const order = await OrdersModel.findOne({ where: { uuid: orderId } });
    if (!order) return res.status(404).json({ message: "Çek tapılmadı" });
    if (Number(order.status) !== 1) {
      return res.status(409).json({ message: "Çek açıq deyil" });
    }
    const rows = await OrderItemPaymentsModel.findAll({
      where: { order_id: orderId, batch_uuid: batchUuid },
    });
    if (rows.length === 0) {
      return res.status(404).json({ message: "Ödəniş tapılmadı" });
    }
    await OrderItemPaymentsModel.destroy({
      where: { order_id: orderId, batch_uuid: batchUuid },
      force: true,
    });
    await OrdersModel.update({ is_synced: 0 }, { where: { uuid: orderId } });

    res.status(200).json({
      message: "success",
      data: {
        total: round2(rows.reduce((s, r) => s + (r.amount || 0), 0)),
        records: rows,
      },
    });
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });
  } catch (e) {
    console.error("cancelItemPayment error:", e);
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  getItemPayments,
  payItems,
  cancelItemPayment,
  getPaidQtyMap,
  hasItemPayments,
  NOT_ALLOWED_MSG,
};

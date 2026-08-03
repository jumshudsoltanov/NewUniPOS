const { sequelize } = require("../database/config");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const OrdersModel = require("../model/OrdersModel");
const WaitersModel = require("../model/WaitersModel");
const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const TimerService = require("../services/TimerService");
const SyncService = require("../services/SyncService");
const MaxCheckService = require("../services/MaxCheckService");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");
const ProductsModel = require("../model/ProductsModel");
const { serviceableItemsSum } = require("../utils/orderServiceFeeBase");
const { sumOrderItemsLineTotal } = require("../utils/orderItemLineTotal");
const axios = require("axios");

const WASTE_API_URL = "https://api.unipos.tech/api/pos/write-off";
const WASTE_API_FALLBACK = "http://46.224.8.157:35627/api/pos/write-off";

/**
 * Admin anbar API-yə tullantı məlumatı göndər.
 * waste items: [{ product_id, qty, price, reason_id, comment }]
 */

const sendWasteToAdmin = async (profileId, wasteItems) => {
  if (!wasteItems || !wasteItems.length) return;
  const payload = { profile_id: profileId, items: wasteItems };
  for (const url of [WASTE_API_URL, WASTE_API_FALLBACK]) {
    try {
      await axios.post(url, payload, { timeout: 10000 });
      console.log(
        `[WASTE] Sent ${wasteItems.length} items to anbar via ${url}`,
      );
      return;
    } catch (e) {
      console.warn(`[WASTE] ${url} failed: ${e.message}`);
    }
  }
  console.error("[WASTE] All endpoints failed — waste not recorded in anbar");
};

// Immediate best-effort sync for critical state transitions (close/delete/reopen/merge).
const syncNowAndQueue = async (orderIds = []) => {
  const uniqueIds = [...new Set((orderIds || []).filter(Boolean))];
  if (!uniqueIds.length) return;

  await Promise.allSettled(uniqueIds.map((id) => SyncService.triggerSync(id)));
  uniqueIds.forEach((id) => SyncService.queueSync(id));
};


/**
 * Helper to attach live timer status to an order object for responses.
 */

const attachLiveTimerToOrder = (order) => {
  const hourlyPrice = TimerService.getEffectiveHourlyPrice(order);
  if (order && order.is_timer_status === 1 && hourlyPrice > 0) {
    const liveStatus = TimerService.calculateLiveStatus(order, hourlyPrice);
    order.dataValues.rate_per_minute = liveStatus.charge;
    order.dataValues.is_timer_clock = liveStatus.clockStr;

    const itemsTotal = sumOrderItemsLineTotal(order.orders_items || []);
    const newTotal = itemsTotal + liveStatus.charge;

    let discount = parseFloat(order.discount || 0);
    let service = parseFloat(order.service_charge || 0);

    if (parseFloat(order.discount_value) > 0) {
      discount =
        order.discount_type === "percent"
          ? (newTotal * parseFloat(order.discount_value)) / 100
          : parseFloat(order.discount_value);
    }
    if (parseFloat(order.service_value) > 0) {
      const svcBase = serviceableItemsSum(order.orders_items || []);
      service =
        order.service_type === "percent"
          ? (svcBase * parseFloat(order.service_value)) / 100
          : parseFloat(order.service_value);
    }

    order.dataValues.amount = newTotal;
    order.dataValues.total = Math.max(0, newTotal - discount + service);
    order.dataValues.discount = discount;
    order.dataValues.service_charge = service;
  }
  return order;
};

/**
 * Məhsul köçürmə / masa dəyişmə / çek birləşdirmə zamanı cəm:
 * məhsul + taymer (işləyəndə canlı hesab, dayananda DB-dəki rate_per_minute).
 * onStopTimer ilə eyni məntiqi izləyir.
 */

const recalculateOrderTotalsWithTimer = async (orderId, transaction = null) => {
  const tx = transaction || undefined;
  const listOfProducts = await OrdersItemsModel.findAll({
    where: { order_id: orderId },
    attributes: ["count", "price", "modifiers"],
    include: [
      {
        model: ProductsModel,
        as: "product",
        attributes: ["hourly_price", "no_service_fee"],
      },
    ],
    transaction: tx,
  });

  const currentOrder = await OrdersModel.findOne({
    where: { uuid: orderId },
    attributes: [
      "discount_value",
      "discount_type",
      "service_value",
      "service_type",
      "deposit",
      "rate_per_minute",
      "delivery_fee",
      "is_timer_status",
      "is_timer_clock",
      "timer_last_started_at",
      "is_active_timer",
    ],
    include: [
      { model: TablesModel, as: "table", attributes: ["hourly_price"] },
    ],
    transaction: tx,
  });

  if (!currentOrder) return;

  const itemsPlain = listOfProducts.map((i) => i.get({ plain: true }));
  const orderPlain = currentOrder.get({ plain: true });
  orderPlain.orders_items = itemsPlain;

  const itemsSum = sumOrderItemsLineTotal(itemsPlain);

  const serviceFeeBase = serviceableItemsSum(listOfProducts);

  let timerCharge = 0;
  const effHourly = TimerService.getEffectiveHourlyPrice(orderPlain);
  if (Number(currentOrder.is_timer_status) === 1 && effHourly > 0) {
    timerCharge = TimerService.calculateLiveStatus(
      orderPlain,
      effHourly,
    ).charge;
  } else {
    timerCharge = parseFloat(currentOrder.rate_per_minute || 0) || 0;
  }

  const total = itemsSum + timerCharge;

  let discount = 0;
  let service = 0;
  const deposit = parseFloat(currentOrder.deposit || 0);
  const { discount_value, discount_type, service_value, service_type } =
    currentOrder;
  if (parseFloat(discount_value || 0) > 0) {
    discount =
      discount_type === "percent"
        ? (total * parseFloat(discount_value)) / 100
        : parseFloat(discount_value);
  }
  if (parseFloat(service_value || 0) > 0) {
    service =
      service_type === "percent"
        ? (serviceFeeBase * parseFloat(service_value)) / 100
        : parseFloat(service_value);
  }
  const netTotal =
    Math.max(total - discount + service, deposit) +
    Number(currentOrder.delivery_fee || 0);

  await OrdersModel.update(
    {
      amount: total,
      discount: discount,
      service_charge: service,
      total: netTotal,
    },
    { where: { uuid: orderId }, transaction: tx },
  );
};

const LoginModel = require("../model/LoginModel");

const sendOrdersItemsToDb = async (req, res) => {
  const { orderId } = req.params;
  const { productList, waiterId, profileId } = req.body;

  if (!orderId || !productList || productList.length === 0) {
    return res
      .status(400)
      .json({ message: "orderId or productList is empty!", data: {} });
  }

  try {
    // insert items in parallel (preserves modifiers/comments per item)
    const savedItems = await Promise.all(
      productList.map((item) =>
        OrdersItemsModel.create({
          order_id: orderId,
          product_id: item.product_id || item.id,
          count: item.quantity || item.count || 1,
          price: item.price,
          operator_id: waiterId,
          profile_id: profileId,
          kds_status: 0,
          modifiers: item.modifiers || null,
          comment: item.comment || null,
          portion_name: item.portion_name || null,
        }),
      ),
    );

    // Fetch totals and order discount info in parallel (məhsul hourly_price üçün product join)
    const [listOfProducts, orderRow] = await Promise.all([
      OrdersItemsModel.findAll({
        where: { order_id: orderId },
        attributes: ["count", "price", "product_id", "modifiers"],
        include: [
          {
            model: ProductsModel,
            as: "product",
            attributes: ["hourly_price", "no_service_fee"],
          },
        ],
      }),
      OrdersModel.findOne({
        where: { uuid: orderId },
        attributes: [
          "discount_value",
          "discount_type",
          "service_value",
          "service_type",
          "deposit",
          "rate_per_minute",
          "delivery_fee",
          "is_timer_status",
          "is_active_timer",
          "is_timer_clock",
          "timer_last_started_at",
        ],
        include: [
          { model: TablesModel, as: "table", attributes: ["hourly_price"] },
        ],
      }),
    ]);

    let currentOrder = orderRow;

    // Masaya məhsul göndəriləndə: masa və ya məhsul saatlığı varsa taymer avtomatik başlasın (yalnız işləmirsə və əvvəlcədən dayandırılmayıbsa)
    const orderPlainForAuto = currentOrder
      ? currentOrder.get({ plain: true })
      : {};
    orderPlainForAuto.orders_items = listOfProducts.map((i) =>
      i.get({ plain: true }),
    );
    const effHourlyAuto =
      TimerService.getEffectiveHourlyPrice(orderPlainForAuto);

    // Only auto-start timer if:
    // 1. There's an hourly rate (table or product)
    // 2. Timer is not currently running
    // 3. Timer was never stopped before (no accumulated time) OR timer was reset
    const hasAccumulatedTime =
      currentOrder?.is_timer_clock &&
      currentOrder.is_timer_clock !== "00:00:00";
    const wasTimerStopped =
      Number(currentOrder?.is_timer_status) === 0 && hasAccumulatedTime;

    if (
      effHourlyAuto > 0 &&
      Number(currentOrder?.is_timer_status) !== 1 &&
      !wasTimerStopped
    ) {
      await OrdersModel.update(
        {
          is_timer_status: 1,
          is_active_timer: 1,
          timer_last_started_at: new Date(),
          is_synced: 0,
        },
        { where: { uuid: orderId } },
      );
      currentOrder = await OrdersModel.findOne({
        where: { uuid: orderId },
        attributes: [
          "discount_value",
          "discount_type",
          "service_value",
          "service_type",
          "deposit",
          "rate_per_minute",
          "delivery_fee",
          "is_timer_status",
          "is_active_timer",
          "is_timer_clock",
          "timer_last_started_at",
        ],
        include: [
          { model: TablesModel, as: "table", attributes: ["hourly_price"] },
        ],
      });
    }

    const orderPlain = currentOrder ? currentOrder.get({ plain: true }) : {};
    orderPlain.orders_items = listOfProducts.map((i) => i.get({ plain: true }));
    const effHourly = TimerService.getEffectiveHourlyPrice(orderPlain);
    const liveTimer = TimerService.calculateLiveStatus(currentOrder, effHourly);

    const itemsTotal = sumOrderItemsLineTotal(listOfProducts);

    const serviceFeeBase = serviceableItemsSum(listOfProducts);

    const total = itemsTotal + liveTimer.charge;

    let discount = 0;
    let service = 0;
    const deposit = parseFloat(currentOrder?.deposit || 0);

    if (currentOrder) {
      const { discount_value, discount_type, service_value, service_type } =
        currentOrder;
      const dValue = parseFloat(discount_value || 0);
      const sValue = parseFloat(service_value || 0);

      if (dValue > 0) {
        if (discount_type === "percent") {
          discount = (total * dValue) / 100;
        } else if (discount_type === "cash") {
          discount = dValue;
        }
      }

      if (sValue > 0) {
        if (service_type === "percent") {
          service = (serviceFeeBase * sValue) / 100;
        } else if (service_type === "cash") {
          service = sValue;
        }
      }
    }

    const deliveryFee = Number(currentOrder?.delivery_fee || 0);
    const netTotal =
      Math.max(total - discount + service, deposit) + deliveryFee;

    // Order update
    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    // Sync trigger
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    const io = getIo();
    if (io) {
      io.emit("table_updated", { orderId });
      io.emit("kds_update_trigger");
    }

    // Return the full updated order for frontend state sync
    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", data: error });
  }
};

const onUpdateDiscountOrder = async (req, res) => {
  const { orderId } = req.params;
  let { discountValue, discountType } = req.body;

  if (!orderId || discountValue === undefined || !discountType) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  discountValue = Number(discountValue);
  if (isNaN(discountValue) || discountValue < 0) {
    return res.status(400).json({ message: "Invalid discount value" });
  }

  if (discountType !== "percent" && discountType !== "cash") {
    return res.status(400).json({ message: "Invalid discount type" });
  }

  try {
    const existing = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: ["uuid"],
    });
    if (!existing) {
      return res.status(404).json({ message: "Order not found" });
    }

    await OrdersModel.update(
      {
        discount_value: discountValue,
        discount_type: discountType,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    await recalculateOrderTotalsWithTimer(orderId);

    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("Discount update error:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

const onUpdateServiceFeeOrder = async (req, res) => {
  const { orderId } = req.params;
  let { serviceValue, feeType } = req.body;

  if (!orderId || serviceValue === undefined || !feeType) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  serviceValue = Number(serviceValue);
  if (isNaN(serviceValue) || serviceValue < 0) {
    return res.status(400).json({ message: "Invalid service value" });
  }

  if (feeType !== "percent" && feeType !== "cash") {
    return res.status(400).json({ message: "Invalid service type" });
  }

  try {
    const existing = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: ["uuid"],
    });
    if (!existing) {
      return res.status(404).json({ message: "Order not found" });
    }

    await OrdersModel.update(
      {
        service_value: serviceValue,
        service_type: feeType,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    await recalculateOrderTotalsWithTimer(orderId);

    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("service update error:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

const onUpdateTableOrder = async (req, res) => {
  const { orderId } = req.params;
  const { newTableId, currentHallId } = req.body;

  if (!newTableId || !orderId || !currentHallId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const updateTable = await OrdersModel.update(
      { hall_id: currentHallId, table_id: newTableId, is_synced: 0 },
      { where: { uuid: orderId } },
    );

    // Yeni masanın saatlığı ilə cəm (taymer məbləği) yenilənsin
    await recalculateOrderTotalsWithTimer(orderId, null);

    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    res
      .status(200)
      .json({ message: "table update success", data: updateTable });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onLockCheck = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const updateLockChecK = await OrdersModel.update(
      { is_locked: status, is_synced: 0 },
      { where: { uuid: orderId } },
    );

    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    res
      .status(200)
      .json({ message: "table update success", data: updateLockChecK });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onUpdateCheckTags = async (req, res) => {
  const { orderId } = req.params;
  const { tags } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await OrdersModel.update(
      { tags: tags, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    // Frontend BooksSlice matcher və UI üçün: uuid + tags qaytarılmalıdır
    res
      .status(200)
      .json({ message: "tags update", data: { uuid: orderId, tags } });

    // Background tasks (non-blocking after response)
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onUpdateCheckComments = async (req, res) => {
  const { orderId } = req.params;
  const { comments } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await OrdersModel.update(
      { note: comments, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      raw: true,
    });
    res.status(200).json({ data: updatedOrder });

    // Background tasks (non-blocking after response)
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onDeleteOrderItems = async (req, res) => {
  const { orderId } = req.params;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: ["status", "deposit", "delivery_fee"],
    });

    const nextStatus =
      Number(currentOrder?.status) === 3 ? 1 : (currentOrder?.status ?? 1);
    const nextTotal =
      Math.max(0, Number(currentOrder?.deposit || 0)) +
      Number(currentOrder?.delivery_fee || 0);

    await OrdersItemsModel.destroy({
      where: { order_id: orderId },
    });

    await OrdersModel.update(
      {
        amount: 0,
        total: nextTotal,
        discount: 0,
        service_charge: 0,
        status: nextStatus,
        end_date: null,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    res.status(200).json({
      message: "delete all items",
      data: { uuid: orderId, status: nextStatus, orders_items: [] },
    });

    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onMergeChecks = async (req, res) => {
  const { currentOrderId } = req.params;
  const { newOrderId } = req.body;

  if (!currentOrderId || !newOrderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const transaction = await sequelize.transaction();

  try {
    const mergedItemsMap = new Map();

    // Get Order Meta
    const currentOrder = await OrdersModel.findOne({
      where: { uuid: currentOrderId },
      transaction,
    });

    if (!currentOrder) throw new Error("Current order not found");

    // Move Items from newOrder to currentOrder
    await OrdersItemsModel.update(
      { order_id: currentOrderId },
      { where: { order_id: newOrderId }, transaction },
    );

    // Get all items now belonging to currentOrder
    const newCurrentItems = await OrdersItemsModel.findAll({
      where: { order_id: currentOrderId },
      transaction,
    });

    // Merge duplicates (sum quantities by product_id)
    newCurrentItems.forEach((item) => {
      const key = item.product_id;

      if (mergedItemsMap.has(key)) {
        const existing = mergedItemsMap.get(key);
        // Ensure quantity is treated as number
        existing.count =
          (Number(existing.count) || 0) + (Number(item.count) || 0);
        mergedItemsMap.set(key, existing);
      } else {
        // Create a clean object for insertion
        const newItem = {
          order_id: currentOrderId,
          product_id: item.product_id,
          count: Number(item.count) || 0,
          price: item.price,
          operator_id: item.operator_id,
          profile_id: item.profile_id,
          is_print: item.is_print,
          is_gift: item.is_gift,
        };
        mergedItemsMap.set(key, newItem);
      }
    });

    // DELETE all items for this order to avoid duplicates in DB
    await OrdersItemsModel.destroy({
      where: { order_id: currentOrderId },
      transaction,
    });

    // BULK CREATE the consolidated items
    const itemsToCreate = Array.from(mergedItemsMap.values());
    if (itemsToCreate.length > 0) {
      await OrdersItemsModel.bulkCreate(itemsToCreate, { transaction });
    }

    // Cəm: məhsullar + taymer (masa/məhsul saatlığı) — köçürmə ilə eyni məntiq
    await recalculateOrderTotalsWithTimer(currentOrderId, transaction);

    // Close the merged (old) order with status=3 and keep row for reliable sync/update on admin
    await OrdersModel.update(
      {
        status: 3,
        amount: 0,
        total: 0,
        end_date: new Date(),
        is_active_timer: 0,
        is_timer_status: 0,
        is_synced: 0,
      },
      { where: { uuid: newOrderId }, transaction },
    );

    // Commit
    await transaction.commit();

    // Try to sync both orders immediately; if any call fails, keep them in queue for retry loop
    await syncNowAndQueue([currentOrderId, newOrderId]);

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: currentOrderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    return res.status(200).json({
      message: "Merge success",
      data: updatedOrder,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onChangeSaleType = async (req, res) => {
  const { orderId } = req.params;
  const { saleType, tableId, hallId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await OrdersModel.update(
      { sale_type: saleType, table_id: tableId, hall_id: hallId, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    await recalculateOrderTotalsWithTimer(orderId, null);
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    res.status(200).json({ message: "sale-type  update", data: updatedOrder });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onUpdateWaiter = async (req, res) => {
  const { orderId } = req.params;
  const { waiterId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await OrdersModel.update(
      { waiter_id: waiterId, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    res.status(200).json({ message: "waiter update" });

    // Background tasks (non-blocking after response)
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onSplitOrder = async (req, res) => {
  const { profileId } = req.params;
  const { data, profile, hallData } = req.body;

  const transaction = await sequelize.transaction();

  try {
    // 1. Validate Original Order
    const originalOrder = await OrdersModel.findOne({
      where: { uuid: data.orderId },
      transaction,
    });
    if (!originalOrder) {
      throw new Error("Original order not found");
    }

    // 2. Determine Logic: Create New or Merge
    let targetOrder = null;
    let isMerge = false;

    // Check if we should try to merge
    if (data.salesType === "dine_in" && data.table && !data.createNewOrder) {
      // Look for existing active order on this table
      targetOrder = await OrdersModel.findOne({
        where: {
          table_id: data.table.id,
          status: 1, // assuming 1 is Active
        },
        transaction,
      });

      if (targetOrder) {
        isMerge = true;
      }
    }

    if (!targetOrder) {
      // CREATE NEW ORDER logic
      const newId = await MaxCheckService.getNextId(profileId);

      // Service Fee Logic
      let serviceValue = null;
      let serviceType = null;

      if (data.salesType === "dine_in") {
        serviceType = "percent";
        serviceValue = 0;
        if (hallData && Number(hallData.service_fee) > 0) {
          serviceValue = Number(hallData.service_fee);
        } else if (profile && profile.service_fee) {
          serviceValue = Number(profile.service_fee);
        }
      }

      targetOrder = await OrdersModel.create(
        {
          id: newId,
          profile_id: profileId,
          waiter_id: data.waiter ? data.waiter.id : originalOrder.waiter_id,
          table_id: data.table ? data.table.id : null,
          hall_id: data.table ? data.table.hall_id : null,
          sale_type: data.salesType,
          status: 1,
          service_type: serviceType,
          service_value: serviceValue,
          guest_count: 0,
          terminal_id: originalOrder.terminal_id,
        },
        { transaction },
      );
    }
    // else we have targetOrder and isMerge=true

    for (const item of data.items) {
      const moveQty = Number(item.qty);
      if (!moveQty || moveQty <= 0) continue;

      const productIdForTarget = Number(item.id);
      let originalItem = null;

      const idsFromPayload =
        Array.isArray(item.allIds) && item.allIds.length > 0
          ? item.allIds
          : item.itemId != null && item.itemId !== ""
            ? [item.itemId]
            : null;

      if (idsFromPayload) {
        let remainingQty = moveQty;
        let firstRow = null;

        for (const currentId of idsFromPayload) {
          if (remainingQty <= 0) break;

          const row = await OrdersItemsModel.findOne({
            where: { order_id: data.orderId, id: currentId },
            transaction,
          });

          if (!row) continue;
          if (!firstRow) firstRow = row;

          const takeQty = Math.min(remainingQty, Number(row.count));
          remainingQty -= takeQty;

          if (Number(row.count) === takeQty) {
            await row.destroy({ transaction });
          } else {
            row.count = Number(row.count) - takeQty;
            await row.save({ transaction });
          }
        }

        if (remainingQty > 0) {
          throw new Error(
            "Köçürmə: kifayət qədər məhsul yoxdur (sətir miqdarı uyğun deyil)",
          );
        }
        if (!firstRow) {
          throw new Error("Köçürmə: məhsul sətri tapılmadı");
        }
        originalItem = firstRow;
      } else {
        originalItem = await OrdersItemsModel.findOne({
          where: { order_id: data.orderId, product_id: item.id },
          transaction,
        });

        if (!originalItem) continue;

        if (Number(originalItem.count) > moveQty) {
          originalItem.count = Number(originalItem.count) - moveQty;
          await originalItem.save({ transaction });
        } else {
          await originalItem.destroy({ transaction });
        }
      }

      const existingTargetItem = await OrdersItemsModel.findOne({
        where: { order_id: targetOrder.uuid, product_id: productIdForTarget },
        transaction,
      });

      if (existingTargetItem) {
        existingTargetItem.count = Number(existingTargetItem.count) + moveQty;
        await existingTargetItem.save({ transaction });
      } else {
        await OrdersItemsModel.create(
          {
            order_id: targetOrder.uuid,
            product_id: productIdForTarget,
            count: moveQty,
            price: originalItem.price,
            operator_id: targetOrder.waiter_id,
            profile_id: profileId,
          },
          { transaction },
        );
      }
    }

    await Promise.all([
      recalculateOrderTotalsWithTimer(data.orderId, transaction),
      recalculateOrderTotalsWithTimer(targetOrder.uuid, transaction),
    ]);

    await transaction.commit();

    SyncService.queueSync(data.orderId);
    SyncService.queueSync(targetOrder.uuid);

    const includeSpec = [
      { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
      {
        model: OrdersItemsModel,
        as: "orders_items",
        separate: true,
        order: [["id", "ASC"]],
        include: [{ model: require("../model/ProductsModel"), as: "product" }],
      },
      {
        model: TablesModel,
        as: "table",
        attributes: ["id", "name", "hourly_price"],
        include: [
          { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
        ],
      },
    ];

    const [updatedOriginalOrder, updatedTargetOrder] = await Promise.all([
      OrdersModel.findOne({
        where: { uuid: data.orderId },
        include: includeSpec,
      }),
      OrdersModel.findOne({
        where: { uuid: targetOrder.uuid },
        include: includeSpec,
      }),
    ]);

    attachLiveTimerToOrder(updatedOriginalOrder);
    attachLiveTimerToOrder(updatedTargetOrder);

    res.status(200).json({
      message: "success",
      data: {
        originalOrder: updatedOriginalOrder,
        newOrder: updatedTargetOrder,
        status: isMerge ? "merged" : "created",
        profile,
        profileId,
      },
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (e) { }
    }
    console.error("Split Order Error:", error);
    res.status(500).json({ message: "Split failed", error: error.message });
  }
};

const onGiftItem = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, allIds, qty, isGift } = req.body;

  if (!orderId || !itemId || !qty) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const transaction = await sequelize.transaction();

  try {
    // Use allIds if provided (multiple rows for same product), otherwise single itemId
    const idsToProcess =
      Array.isArray(allIds) && allIds.length > 0 ? allIds : [itemId];
    let remainingQty = Number(qty);
    let firstOriginalItem = null;

    // 1. Reduce count across all rows, distributing qty
    for (const currentId of idsToProcess) {
      if (remainingQty <= 0) break;

      const item = await OrdersItemsModel.findOne({
        where: { order_id: orderId, id: currentId },
        transaction,
      });

      if (!item) continue;
      if (!firstOriginalItem) firstOriginalItem = item;

      const takeQty = Math.min(remainingQty, Number(item.count));
      remainingQty -= takeQty;

      if (Number(item.count) === takeQty) {
        await item.destroy({ transaction });
      } else {
        item.count = Number(item.count) - takeQty;
        await item.save({ transaction });
      }
    }

    if (!firstOriginalItem) {
      throw new Error("Item not found or quantity invalid");
    }

    if (remainingQty > 0) {
      throw new Error("Invalid quantity - not enough items");
    }

    const originalItem = firstOriginalItem;
    const moveQty = Number(qty);

    // 2. Add to Target Item (Gift or Normal)
    const targetIsGift = isGift ? 1 : 0;
    const targetItem = await OrdersItemsModel.findOne({
      where: {
        order_id: orderId,
        product_id: originalItem.product_id,
        is_gift: targetIsGift,
      },
      transaction,
    });

    if (targetItem) {
      targetItem.count = Number(targetItem.count) + moveQty;

      if (targetIsGift === 1) {
        targetItem.price = 0;
      } else {
        // Restore price - wait, if original was gift, it had price 0. Steps: Find product.
        const product = await OrdersItemsModel.findOne({
          where: {
            order_id: orderId,
            product_id: originalItem.product_id,
            is_gift: 0,
          },
          transaction,
        });
        // If there is another non-gift item, copy its price?
        if (product) targetItem.price = product.price;
        else {
          console.log("Error");
        }
      }
      await targetItem.save({ transaction });
    } else {
      // Create new
      let newPrice = originalItem.price; // This might be 0 if original was gift

      if (targetIsGift === 1) {
        newPrice = 0;
      } else {
        // Try to find the price from a non-gift sibling OR use original_price if available
        const sibling = await OrdersItemsModel.findOne({
          where: {
            order_id: orderId,
            product_id: originalItem.product_id,
            is_gift: 0,
          },
          paranoid: false,
          transaction,
        });

        if (sibling && parseFloat(sibling.price) > 0) {
          newPrice = parseFloat(sibling.price);
        } else if (
          originalItem.original_price &&
          parseFloat(originalItem.original_price) > 0
        ) {
          newPrice = parseFloat(originalItem.original_price);
        } else if (originalItem.price > 0) {
          newPrice = parseFloat(originalItem.price);
        } else {
          // Last resort: we might have 0 price if we are ungifting the last gift item and no original price stored.
          // We should try to allow content to have price 0 or handle it gracefully.
          // Usually original_price should be set when discounting/gifting.
          newPrice = 0; // Or keep it 0 if unknown
        }
      }

      await OrdersItemsModel.create(
        {
          order_id: orderId,
          product_id: originalItem.product_id,
          count: moveQty,
          price: newPrice,
          discount_value: 0,
          discount_type: 0,
          original_price: newPrice > 0 ? newPrice : null, // If we found a price, set it as original
          operator_id: originalItem.operator_id,
          profile_id: originalItem.profile_id,
          is_gift: targetIsGift,
        },
        { transaction },
      );
    }

    // Recalculate Totals (Robust)
    const allItems = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price", "modifiers"],
      include: [
        { model: ProductsModel, as: "product", attributes: ["no_service_fee"] },
      ],
      transaction,
    });

    const total = sumOrderItemsLineTotal(allItems);

    const serviceFeeBaseMerge = serviceableItemsSum(allItems);

    const ord = await OrdersModel.findOne({
      where: { uuid: orderId },
      transaction,
    });
    let discount = 0;
    let service = 0;
    if (ord) {
      const globDiscVal = parseFloat(ord.discount_value) || 0;
      const globServVal = parseFloat(ord.service_value) || 0;

      if (globDiscVal > 0) {
        discount =
          ord.discount_type === "percent"
            ? (total * globDiscVal) / 100
            : globDiscVal;
      }
      if (globServVal > 0) {
        service =
          ord.service_type === "percent"
            ? (serviceFeeBaseMerge * globServVal) / 100
            : globServVal;
      }
    }

    const netTotal =
      Math.max(total - discount + service, parseFloat(ord.deposit || 0)) +
      Number(ord.delivery_fee || 0);

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount,
        service_charge: service,
        is_synced: 0,
      },
      { where: { uuid: orderId }, transaction },
    );

    await transaction.commit();

    // Sync trigger (AFTER commit so admin gets the updated data)
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    // Fetch full order data to return
    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    res.status(200).json(updatedOrder);
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (e) { }
    }
    console.error("Gift Error:", error);
    res.status(500).json({ message: "Error", error: error.message });
  }
};

const onUpdateItemDiscount = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, discountValue, discountType } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const item = await OrdersItemsModel.findOne({
      where: { order_id: orderId, id: itemId },
      transaction,
    });

    if (!item) {
      throw new Error("Item not found");
    }

    // Ensure numeric values
    let currentPrice = parseFloat(item.price);
    let originalPrice = item.original_price
      ? parseFloat(item.original_price)
      : 0;

    // Initialize original_price if it's not set (first discount)
    // If originalPrice is 0 (and currentPrice > 0), assume first time.
    if (!originalPrice && currentPrice > 0) {
      originalPrice = currentPrice;
      item.original_price = originalPrice;
    } else if (!originalPrice) {
      // logic fallback if both 0
      originalPrice = 0;
    }

    let newPrice = originalPrice;
    let discVal = parseFloat(discountValue) || 0;

    if (discountType === "percent") {
      let discountAmt = (originalPrice * discVal) / 100;
      newPrice = originalPrice - discountAmt;
    } else {
      newPrice = originalPrice - discVal;
    }

    if (newPrice < 0) newPrice = 0;

    // Update Item
    item.price = newPrice;
    item.discount_value = discVal;
    item.discount_type = discountType === "percent" ? 1 : 2;

    await item.save({ transaction });

    // Recalculate Totals
    // Fetch ALL items to sum standard 'price' * 'count'
    const allItems = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price", "modifiers"],
      include: [
        { model: ProductsModel, as: "product", attributes: ["no_service_fee"] },
      ],
      transaction,
    });

    const total = sumOrderItemsLineTotal(allItems);

    const serviceFeeBaseGift = serviceableItemsSum(allItems);

    // Global Order Discount / Service Logic
    const ord = await OrdersModel.findOne({
      where: { uuid: orderId },
      transaction,
    });
    let discount = 0;
    let service = 0;

    if (ord) {
      const globDiscVal = parseFloat(ord.discount_value) || 0;
      const globServVal = parseFloat(ord.service_value) || 0;

      if (globDiscVal > 0) {
        discount =
          ord.discount_type === "percent"
            ? (total * globDiscVal) / 100
            : globDiscVal;
      }
      if (globServVal > 0) {
        service =
          ord.service_type === "percent"
            ? (serviceFeeBaseGift * globServVal) / 100
            : globServVal;
      }
    }

    const netTotal =
      Math.max(total - discount + service, parseFloat(ord.deposit || 0)) +
      Number(ord.delivery_fee || 0);

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0,
      },
      { where: { uuid: orderId }, transaction },
    );
    await transaction.commit();

    // Sync trigger (AFTER commit so admin gets the updated data)
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    res.status(200).json(updatedOrder);
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
      }
    }
    console.error("Discount Error:", error);
    res.status(500).json({ message: "Error", error: error.message });
  }
};

const onDeleteCheck = async (req, res) => {
  const { orderId } = req.params;
  const { reason, forceDestroy, waste, wasteComment } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const { getIo } = require("../socket/MasterServer");

    // Silinmədən əvvəl bütün items-i götür (anbar üçün)
    const orderItems = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      raw: true,
    });

    const ord = await OrdersModel.findOne({
      where: { uuid: orderId },
      raw: true,
    });

    if (forceDestroy) {
      const serverItemCount = orderItems.length;
      console.warn(
        `[DELETE_CHECK_GUARD] forceDestroy converted to soft-delete for reliable admin sync. order=${orderId}, items=${serverItemCount}`,
      );
    }

    await OrdersModel.update(
      {
        status: 3,
        end_date: new Date(),
        is_delete_reason_id: reason,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    if (getIo()) getIo().emit("table_updated", { orderId });

    syncNowAndQueue([orderId]).catch((e) =>
      console.warn(`[DELETE_CHECK_SYNC] ${orderId}: ${e?.message || e}`),
    );

    // Anbar əməliyyatı — arxa planda
    if (orderItems.length > 0 && ord?.profile_id) {
      const anbarItems = orderItems.map((item) => ({
        product_id: item.product_id,
        qty: Number(item.count) || 1,
        price: item.price,
        reason_id: reason || null,
        comment: wasteComment || "",
        is_waste: waste ? true : false,
      }));
      sendWasteToAdmin(ord.profile_id, anbarItems).catch((e) =>
        console.error("[DELETE_CHECK] sendWasteToAdmin error:", e.message),
      );
    }

    return res.status(200).json({ message: "success" });
  } catch (error) {
    console.error("Delete check error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onCloseOrder = async (req, res) => {
  const { orderId } = req.params;
  const { payments, status, profileId, waiterId, note, is_tax } = req.body;

  if (!orderId || !status || !profileId || !waiterId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const transaction = await sequelize.transaction();

  try {
    // 1. Calculate final timer charge if active
    const order = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: TablesModel, as: "table", attributes: ["hourly_price"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          include: [
            {
              model: ProductsModel,
              as: "product",
              attributes: ["hourly_price"],
            },
          ],
        },
      ],
      transaction,
    });

    let timerUpdate = {};
    if (order && order.is_active_timer) {
      const live = TimerService.calculateLiveStatus(
        order,
        TimerService.getEffectiveHourlyPrice(order),
      );
      timerUpdate = {
        is_active_timer: 0,
        is_timer_status: 1, // Keep status as 1 to show it was a timer order
        is_timer_clock: live.clockStr,
        rate_per_minute: live.charge,
        is_synced: 0,
      };
    }

    // Update Order Status, Note, and End Date (and Timer if needed)
    await OrdersModel.update(
      {
        status: status,
        note: note || "",
        end_date: new Date(),
        is_synced: 0,
        is_tax: is_tax !== undefined ? is_tax : 0,
        ...timerUpdate,
      },
      { where: { uuid: orderId }, transaction },
    );

    // Re-fetch items to calculate final total correctly including items + timer
    const items = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      include: [
        { model: ProductsModel, as: "product", attributes: ["no_service_fee"] },
      ],
      transaction,
    });
    const subtotal = sumOrderItemsLineTotal(items);
    const serviceFeeBaseClose = serviceableItemsSum(items);
    const finalTimerCharge =
      timerUpdate.rate_per_minute !== undefined
        ? timerUpdate.rate_per_minute
        : order?.rate_per_minute || 0;

    // Simple Total Recalculation (should ideally consider discounts/service but keeping it basic for now consistent with other parts)
    const orderToUpdate = await OrdersModel.findOne({
      where: { uuid: orderId },
      transaction,
    });
    let total = subtotal + Number(finalTimerCharge);

    // Apply global discounts/service if any
    let disc = 0;
    if (orderToUpdate.discount_value > 0) {
      disc =
        orderToUpdate.discount_type === "percent"
          ? (subtotal * orderToUpdate.discount_value) / 100
          : orderToUpdate.discount_value;
    }
    let serv = 0;
    if (orderToUpdate.service_value > 0) {
      serv =
        orderToUpdate.service_type === "percent"
          ? (serviceFeeBaseClose * orderToUpdate.service_value) / 100
          : orderToUpdate.service_value;
    }

    const deliveryFee = Number(orderToUpdate.delivery_fee || 0);
    const finalTotal =
      Math.max(total - disc + serv, parseFloat(orderToUpdate.deposit || 0)) +
      deliveryFee;

    await OrdersModel.update(
      {
        amount: subtotal,
        discount: disc,
        service_charge: serv,
        total: finalTotal,
      },
      { where: { uuid: orderId }, transaction },
    );

    // 2. Remove old payments (prevents duplicates on re-close after return)
    await OrderPaymentsModel.destroy({
      where: { order_id: orderId },
      force: true,
      transaction,
    });

    // 3. Insert Payments if provided
    if (payments && payments.length > 0) {
      const paymentRecords = payments.map((p) => ({
        profile_id: profileId,
        order_id: orderId,
        status: status.toString(),
        operator_id: waiterId,
        payment_method_id: p.payment_method_id || 0,
        without_payment_method_id: p.without_payment_method_id || 0,
        paid: parseFloat(p.amount) || 0,
        note: note || "",
        name: p.name || null,
      }));

      await OrderPaymentsModel.bulkCreate(paymentRecords, { transaction });
    }

    // 5. Commit and respond immediately
    await transaction.commit();
    res.status(200).json({ message: "success" });

    // Trigger sync in background (non-blocking)
    syncNowAndQueue([orderId]).catch((e) =>
      console.warn(`[CLOSE_SYNC] ${orderId}: ${e?.message || e}`),
    );
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (e) { }
    }
    console.error("Close Order Error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const onUpdateDepositOrder = async (req, res) => {
  const { orderId } = req.params;
  let { depositValue } = req.body;

  if (!orderId || depositValue === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    depositValue = Number(depositValue);

    if (isNaN(depositValue) || depositValue < 0) {
      return res.status(400).json({ message: "Invalid deposit value" });
    }

    // Recalculate total with the new deposit
    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: ["amount", "discount", "service_charge"],
    });

    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const amount = parseFloat(currentOrder.amount || 0);
    const discount = parseFloat(currentOrder.discount || 0);
    const service_charge = parseFloat(currentOrder.service_charge || 0);

    const newTotal = Math.max(amount - discount + service_charge, depositValue);

    await OrdersModel.update(
      {
        deposit: depositValue,
        total: newTotal,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    syncNowAndQueue([orderId]).catch((e) =>
      console.warn(`[DEPOSIT_SYNC] ${orderId}: ${e?.message || e}`),
    );
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    return res.status(200).json({
      message: "Deposit updated successfully!",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Deposit update error:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

// Reopen Check - simply sets status back to 1 (active)
const onReopenOrder = async (req, res) => {
  const { orderId } = req.params;
  const { reasonId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await OrdersModel.update(
      {
        status: 1,
        end_date: null,
        is_delete_reason_id: reasonId,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );
    syncNowAndQueue([orderId]).catch((e) =>
      console.warn(`[REOPEN_SYNC] ${orderId}: ${e?.message || e}`),
    );
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    return res.status(200).json({
      message: "Check reopened successfully!",
      data: { orderId, status: 1 },
    });
  } catch (error) {
    console.error("Reopen order error:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

// Return Check - marks as returned with reason and reopens
const onReturnCheck = async (req, res) => {
  const { orderId } = req.params;
  const { is_return, is_delete_reason_id } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await OrdersModel.update(
      {
        is_return: is_return || 1,
        is_delete_reason_id: is_delete_reason_id,
        status: 1, // Reopen the check
        end_date: null, // Clear the end date
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );
    syncNowAndQueue([orderId]).catch((e) =>
      console.warn(`[RETURN_SYNC] ${orderId}: ${e?.message || e}`),
    );
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    return res.status(200).json({
      message: "Check returned and reopened successfully!",
      data: { orderId, is_return, is_delete_reason_id, status: 1 },
    });
  } catch (error) {
    console.error("Return check error:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

// Delete Item with Reason
const onDeleteItemWithReason = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, reasonId, qty } = req.body;

  if (!orderId || !itemId) {
    console.error(
      `[DELETE REASON ERROR] Missing fields! orderId: ${orderId}, itemId: ${itemId}, reasonId: ${reasonId}`,
    );
    return res.status(400).json({ message: "Missing required fields" });
  }

  const transaction = await sequelize.transaction();

  try {
    const item = await OrdersItemsModel.findOne({
      where: { order_id: orderId, id: itemId },
      transaction,
    });

    if (!item) {
      throw new Error("Item not found");
    }

    console.log(
      `[DELETE REASON] Order: ${orderId}, Item: ${itemId}, Reason: ${reasonId}, Qty: ${qty || "ALL"}`,
    );

    if (qty && qty > 0 && qty < item.count) {
      // Partial delete - currently we don't have a good place to store reason for partial,
      // but let's at least update the item if we were to keep track.
      // For now, full delete is more common for "reasons".
      item.count -= qty;
      await item.save({ transaction });
    } else {
      // Full delete
      item.is_delete_reason_id = reasonId;
      await item.save({ transaction }); // Save reason before soft delete
      await item.destroy({ transaction });
    }

    // Recalculate totals
    const allItems = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price", "modifiers"],
      include: [
        { model: ProductsModel, as: "product", attributes: ["no_service_fee"] },
      ],
      transaction,
    });

    const total = sumOrderItemsLineTotal(allItems);

    const serviceFeeBaseDel = serviceableItemsSum(allItems);

    const ord = await OrdersModel.findOne({
      where: { uuid: orderId },
      transaction,
    });

    let discount = 0;
    let service = 0;

    if (ord) {
      const dVal = parseFloat(ord.discount_value) || 0;
      const sVal = parseFloat(ord.service_value) || 0;

      if (dVal > 0) {
        discount =
          ord.discount_type === "percent" ? (total * dVal) / 100 : dVal;
      }
      if (sVal > 0) {
        service =
          ord.service_type === "percent"
            ? (serviceFeeBaseDel * sVal) / 100
            : sVal;
      }
    }

    const netTotal =
      Math.max(total - discount + service, parseFloat(ord.deposit || 0)) +
      Number(ord.delivery_fee || 0);

    // Son məhsul silinəndə çek açıq qalır — istifadəçi özü "Çeki ləğv et" düyməsi ilə silməlidir
    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount,
        service_charge: service,
        is_synced: 0,
      },
      { where: { uuid: orderId }, transaction },
    );
    await transaction.commit();

    // Respond immediately — frontend will refresh via getActiveOrders after all deletions
    res
      .status(200)
      .json({ uuid: orderId, deletedItemId: itemId, success: true });

    // Background tasks (non-blocking)
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (e) { }
    }
    console.error("Delete Item Error:", error);
    res
      .status(500)
      .json({ message: "Error deleting item", error: error.message });
  }
};

const onUpdateItemPrice = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, newPrice } = req.body;

  try {
    const item = await OrdersItemsModel.findOne({
      where: {
        order_id: orderId,
        id: itemId,
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Ensure price is a number
    item.price = parseFloat(newPrice);
    await item.save();

    // --- Recalculate Order Total (Logic from sendOrdersItemsToDb) ---

    // 1. Get all items to sum up
    const listOfProducts = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price", "modifiers"],
      include: [
        { model: ProductsModel, as: "product", attributes: ["no_service_fee"] },
      ],
    });

    // 2. Calculate raw total
    const total = sumOrderItemsLineTotal(listOfProducts);

    const serviceFeeBasePrice = serviceableItemsSum(listOfProducts);

    // 3. Get Order details for discount/service/deposit
    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: [
        "discount_value",
        "discount_type",
        "service_value",
        "service_type",
        "deposit",
        "delivery_fee",
      ],
    });

    let discount = 0;
    let service = 0;
    const deposit = parseFloat(currentOrder?.deposit || 0);

    if (currentOrder) {
      const { discount_value, discount_type, service_value, service_type } =
        currentOrder;
      const dValue = parseFloat(discount_value || 0);
      const sValue = parseFloat(service_value || 0);

      // Calculate Discount
      if (dValue > 0) {
        if (discount_type === "percent") {
          discount = (total * dValue) / 100;
        } else if (discount_type === "cash") {
          discount = dValue;
        }
      }

      // Calculate Service Fee
      if (sValue > 0) {
        if (service_type === "percent") {
          service = (serviceFeeBasePrice * sValue) / 100;
        } else if (service_type === "cash") {
          service = sValue;
        }
      }
    }

    const netTotal =
      Math.max(total - discount + service, deposit) +
      Number(currentOrder?.delivery_fee || 0);

    // 4. Update OrdersModel
    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    // Return success with full order data for frontend updates
    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    res.status(200).json({
      message: "success",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Update Price Error:", error);
    res
      .status(500)
      .json({ message: "Error updating price", error: error.message });
  }
};

const onUpdateItemCount = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, newCount, modifiers, comment } = req.body;

  if (!orderId || !itemId || newCount === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const item = await OrdersItemsModel.findOne({
      where: {
        order_id: orderId,
        id: itemId,
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    item.count = parseInt(newCount);
    if (modifiers !== undefined) {
      item.modifiers = Array.isArray(modifiers)
        ? JSON.stringify(modifiers)
        : modifiers || null;
    }
    if (comment !== undefined) {
      item.comment = comment || null;
    }
    item.kds_status = 0; // Reset for KDS
    await item.save();

    // Recalculate Order Total
    const listOfProducts = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price", "modifiers"],
      include: [
        { model: ProductsModel, as: "product", attributes: ["no_service_fee"] },
      ],
    });

    const total = sumOrderItemsLineTotal(listOfProducts);

    const serviceFeeBaseCount = serviceableItemsSum(listOfProducts);

    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: [
        "discount_value",
        "discount_type",
        "service_value",
        "service_type",
        "deposit",
        "delivery_fee",
      ],
    });

    let discount = 0;
    let service = 0;
    const deposit = parseFloat(currentOrder?.deposit || 0);

    if (currentOrder) {
      const { discount_value, discount_type, service_value, service_type } =
        currentOrder;
      const dValue = parseFloat(discount_value || 0);
      const sValue = parseFloat(service_value || 0);

      if (dValue > 0) {
        if (discount_type === "percent") {
          discount = (total * dValue) / 100;
        } else if (discount_type === "cash") {
          discount = dValue;
        }
      }

      if (sValue > 0) {
        if (service_type === "percent") {
          service = (serviceFeeBaseCount * sValue) / 100;
        } else if (service_type === "cash") {
          service = sValue;
        }
      }
    }

    const netTotal =
      Math.max(total - discount + service, deposit) +
      Number(currentOrder?.delivery_fee || 0);

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) {
      getIo().emit("table_updated", { orderId });
      getIo().emit("kds_update_trigger");
    }

    // Return success with full order data for frontend updates
    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    res.status(200).json({
      message: "success",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Update Count Error:", error);
    res
      .status(500)
      .json({ message: "Error updating count", error: error.message });
  }
};

const onAssignCustomer = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customer_id } = req.body;

    await OrdersModel.update(
      { customer_id: customer_id || null, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    const updated = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });
    attachLiveTimerToOrder(updated);
    return res.json({ message: "success", data: updated });
  } catch (error) {
    console.error("Assign customer error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const onAssignCourier = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { courier_id, delivery_fee } = req.body;
    const newDeliveryFee = Number(delivery_fee || 0);

    await OrdersModel.update(
      {
        courier_id: courier_id || null,
        delivery_fee: newDeliveryFee,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    // Recalculate total with new delivery_fee
    const ord = await OrdersModel.findOne({ where: { uuid: orderId } });
    if (ord) {
      const items = await OrdersItemsModel.findAll({
        where: { order_id: orderId },
        attributes: ["count", "price", "modifiers"],
        include: [
          {
            model: ProductsModel,
            as: "product",
            attributes: ["no_service_fee"],
          },
        ],
      });

      const subtotal =
        sumOrderItemsLineTotal(items) + Number(ord.rate_per_minute || 0);

      const serviceFeeBaseCourier = serviceableItemsSum(items);

      let discount = 0,
        service = 0;
      const dVal = parseFloat(ord.discount_value || 0);
      const sVal = parseFloat(ord.service_value || 0);
      if (dVal > 0)
        discount =
          ord.discount_type === "percent" ? (subtotal * dVal) / 100 : dVal;
      if (sVal > 0)
        service =
          ord.service_type === "percent"
            ? (serviceFeeBaseCourier * sVal) / 100
            : sVal;

      const netTotal =
        Math.max(subtotal - discount + service, parseFloat(ord.deposit || 0)) +
        newDeliveryFee;

      await OrdersModel.update(
        {
          amount: subtotal,
          total: netTotal,
          discount,
          service_charge: service,
        },
        { where: { uuid: orderId } },
      );
    }

    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    const updated = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });
    attachLiveTimerToOrder(updated);
    return res.json({ message: "success", data: updated });
  } catch (error) {
    console.error("Assign courier error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const onUpdateGuestCount = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { guestCount } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ message: "false", data: "Missing orderId" });
    }

    const updated = await OrdersModel.update(
      { guest_count: guestCount, is_synced: 0 },
      { where: { uuid: orderId } },
    );

    if (updated[0] === 0) {
      return res
        .status(404)
        .json({ message: "false", data: "Order not found" });
    }

    res.status(200).json({ message: "success" });

    // Background tasks (non-blocking after response)
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId: orderId });
  } catch (error) {
    console.error("Guest count update error:", error);
    return res.status(500).json({ message: "false", data: error.message });
  }
};

const incrementPrintCount = async (req, res) => {
  const { orderId } = req.params;

  if (!orderId) {
    return res.status(400).json({ message: "Missing orderId" });
  }

  try {
    const order = await OrdersModel.findOne({ where: { uuid: orderId } });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const newCount = (order.print_count || 0) + 1;

    await OrdersModel.update(
      { print_count: newCount, is_synced: 0 },
      { where: { uuid: orderId } },
    );

    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);

    return res
      .status(200)
      .json({ message: "Print count updated", data: updatedOrder });
  } catch (error) {
    console.error("Error incrementing print count:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onStartTimer = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await OrdersModel.findOne({ where: { uuid: orderId } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    await OrdersModel.update(
      {
        is_timer_status: 1,
        is_active_timer: 1,
        timer_last_started_at: new Date(),
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          include: [
            { model: require("../model/ProductsModel"), as: "product" },
          ],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    res.json({ success: true, message: "Timer started", data: updatedOrder });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const onStopTimer = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: TablesModel, as: "table", attributes: ["hourly_price"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          include: [
            {
              model: ProductsModel,
              as: "product",
              attributes: ["hourly_price"],
            },
          ],
        },
      ],
    });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const hourlyPrice = TimerService.getEffectiveHourlyPrice(order);

    // Always calculate server-side using timer_last_started_at for accuracy
    const liveStatus = TimerService.calculateLiveStatus(order, hourlyPrice);
    const timerCharge = liveStatus.charge;
    const finalClockStr = liveStatus.clockStr;

    await OrdersModel.update(
      {
        is_timer_status: 0,
        is_active_timer: 0,
        is_timer_clock: finalClockStr,
        rate_per_minute: timerCharge,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    // Recalculate total
    const [listOfProducts, currentOrder] = await Promise.all([
      OrdersItemsModel.findAll({
        where: { order_id: orderId },
        attributes: ["count", "price", "modifiers"],
        include: [
          {
            model: ProductsModel,
            as: "product",
            attributes: ["no_service_fee"],
          },
        ],
      }),
      OrdersModel.findOne({
        where: { uuid: orderId },
        attributes: [
          "discount_value",
          "discount_type",
          "service_value",
          "service_type",
          "deposit",
          "rate_per_minute",
          "delivery_fee",
        ],
      }),
    ]);

    const total =
      sumOrderItemsLineTotal(listOfProducts) +
      (parseFloat(currentOrder?.rate_per_minute) || 0);

    const serviceFeeBaseStop = serviceableItemsSum(listOfProducts);

    let discount = 0;
    let service = 0;
    if (currentOrder) {
      const { discount_value, discount_type, service_value, service_type } =
        currentOrder;
      if (parseFloat(discount_value) > 0) {
        discount =
          discount_type === "percent"
            ? (total * parseFloat(discount_value)) / 100
            : parseFloat(discount_value);
      }
      if (parseFloat(service_value) > 0) {
        service =
          service_type === "percent"
            ? (serviceFeeBaseStop * parseFloat(service_value)) / 100
            : parseFloat(service_value);
      }
    }
    const netTotal =
      Math.max(
        total - discount + service,
        parseFloat(currentOrder?.deposit || 0),
      ) + Number(currentOrder?.delivery_fee || 0);

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        { model: OrdersItemsModel, as: "orders_items", separate: true },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    res.json({
      success: true,
      message: "Timer stopped",
      charge: timerCharge,
      data: updatedOrder,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const onResetTimer = async (req, res) => {
  const { orderId } = req.params;
  try {
    await OrdersModel.update(
      {
        is_timer_status: 0,
        is_timer_clock: "00:00:00",
        is_active_timer: 0,
        rate_per_minute: 0,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    // Recalculate total after reset
    const [listOfProducts, currentOrder] = await Promise.all([
      OrdersItemsModel.findAll({
        where: { order_id: orderId },
        attributes: ["count", "price", "modifiers"],
        include: [
          {
            model: ProductsModel,
            as: "product",
            attributes: ["no_service_fee"],
          },
        ],
      }),
      OrdersModel.findOne({
        where: { uuid: orderId },
        attributes: [
          "discount_value",
          "discount_type",
          "service_value",
          "service_type",
          "deposit",
          "rate_per_minute",
          "delivery_fee",
        ],
      }),
    ]);

    const total =
      sumOrderItemsLineTotal(listOfProducts) +
      (parseFloat(currentOrder?.rate_per_minute) || 0);

    const serviceFeeBaseReset = serviceableItemsSum(listOfProducts);

    let discount = 0;
    let service = 0;
    if (currentOrder) {
      const { discount_value, discount_type, service_value, service_type } =
        currentOrder;
      if (parseFloat(discount_value) > 0) {
        discount =
          discount_type === "percent"
            ? (total * parseFloat(discount_value)) / 100
            : parseFloat(discount_value);
      }
      if (parseFloat(service_value) > 0) {
        service =
          service_type === "percent"
            ? (serviceFeeBaseReset * parseFloat(service_value)) / 100
            : parseFloat(service_value);
      }
    }
    const netTotal =
      Math.max(
        total - discount + service,
        parseFloat(currentOrder?.deposit || 0),
      ) + Number(currentOrder?.delivery_fee || 0);

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0,
      },
      { where: { uuid: orderId } },
    );

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        { model: OrdersItemsModel, as: "orders_items", separate: true },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hourly_price"],
        },
      ],
    });

    attachLiveTimerToOrder(updatedOrder);
    SyncService.queueSync(orderId);
    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { orderId });

    res.json({ success: true, message: "Timer reset", data: updatedOrder });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  sendOrdersItemsToDb,
  onUpdateItemPrice,
  onUpdateDiscountOrder,
  onUpdateTableOrder,
  onLockCheck,
  onUpdateCheckTags,
  onUpdateCheckComments,
  onUpdateServiceFeeOrder,
  onDeleteOrderItems,
  onMergeChecks,
  onChangeSaleType,
  onUpdateWaiter,
  onSplitOrder,
  onGiftItem,
  onUpdateItemDiscount,
  onDeleteCheck,
  onUpdateDepositOrder,
  onCloseOrder,
  onReturnCheck,
  onReopenOrder,
  onDeleteItemWithReason,
  onBatchDeleteItems: async (req, res) => {
    const { orderId } = req.params;
    // items: [{ itemId, qty, reasonId, waste, wasteComment, product_id, price }]
    const { items } = req.body;

    if (!orderId || !items || !items.length) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const transaction = await sequelize.transaction();
    // waste=true → tullantı (write_off), waste=false → geri qaytarma (return)
    const wasteItems = []; // is_waste: true
    const returnItems = []; // is_waste: false (geri qaytarma)
    try {
      for (const {
        itemId,
        qty,
        reasonId,
        waste,
        wasteComment,
        product_id,
        price,
      } of items) {
        const item = await OrdersItemsModel.findOne({
          where: { order_id: orderId, id: itemId },
          transaction,
        });
        if (!item) continue; // already gone, skip

        const deletedQty =
          qty && qty > 0 ? Math.min(qty, item.count) : item.count;
        const remaining = item.count - deletedQty;

        const anbarItem = {
          product_id: product_id || item.product_id,
          qty: deletedQty,
          price: price || item.price,
          reason_id: reasonId || null,
          comment: wasteComment || "",
          is_waste: waste ? true : false,
        };

        if (waste) {
          wasteItems.push(anbarItem);
        } else {
          returnItems.push(anbarItem);
        }

        if (remaining > 0) {
          item.count = remaining;
          await item.save({ transaction });
        } else {
          item.is_delete_reason_id = reasonId || null;
          await item.save({ transaction });
          await item.destroy({ transaction });
        }
      }

      // Recalculate totals once
      const allItems = await OrdersItemsModel.findAll({
        where: { order_id: orderId },
        attributes: ["count", "price", "modifiers"],
        include: [
          {
            model: ProductsModel,
            as: "product",
            attributes: ["no_service_fee"],
          },
        ],
        transaction,
      });

      const ord = await OrdersModel.findOne({
        where: { uuid: orderId },
        transaction,
      });
      const timerCharge = parseFloat(ord?.rate_per_minute || 0);

      const total = sumOrderItemsLineTotal(allItems) + timerCharge;

      const serviceFeeBaseBatch = serviceableItemsSum(allItems);

      let discount = 0,
        service = 0;
      if (ord) {
        const dVal = parseFloat(ord.discount_value) || 0;
        const sVal = parseFloat(ord.service_value) || 0;
        if (dVal > 0)
          discount =
            ord.discount_type === "percent" ? (total * dVal) / 100 : dVal;
        if (sVal > 0)
          service =
            ord.service_type === "percent"
              ? (serviceFeeBaseBatch * sVal) / 100
              : sVal;
      }
      const netTotal =
        Math.max(total - discount + service, parseFloat(ord?.deposit || 0)) +
        Number(ord?.delivery_fee || 0);

      // Son məhsul silinəndə çek açıq qalır — istifadəçi özü "Çeki ləğv et" düyməsi ilə silməlidir
      await OrdersModel.update(
        {
          amount: total,
          total: netTotal,
          discount,
          service_charge: service,
          is_synced: 0,
        },
        { where: { uuid: orderId }, transaction },
      );

      await transaction.commit();

      res.status(200).json({
        uuid: orderId,
        success: true,
        deletedItems: items.map((i) => i.itemId),
      });

      syncNowAndQueue([orderId]).catch((e) =>
        console.warn(`[BATCH_DELETE_SYNC] ${orderId}: ${e?.message || e}`),
      );
      const { getIo } = require("../socket/MasterServer");
      if (getIo()) getIo().emit("table_updated", { orderId });

      // Waste + return items-i arxa planda admin anbar API-yə göndər
      const allAnbarItems = [...wasteItems, ...returnItems];
      if (allAnbarItems.length > 0) {
        const profileId = ord?.profile_id;
        if (profileId) {
          sendWasteToAdmin(profileId, allAnbarItems).catch((e) =>
            console.error("[WASTE] sendWasteToAdmin error:", e.message),
          );
        }
      }
    } catch (error) {
      try {
        await transaction.rollback();
      } catch (e) { }
      console.error("Batch Delete Error:", error);
      res
        .status(500)
        .json({ message: "Error deleting items", error: error.message });
    }
  },
  onUpdateItemCount,
  onAssignCustomer,
  onAssignCourier,
  incrementPrintCount,
  onUpdateGuestCount,
  onStartTimer,
  onStopTimer,
  onResetTimer,
};

const { sequelize } = require("../database/config");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const OrdersModel = require("../model/OrdersModel");
const WaitersModel = require("../model/WaitersModel");
const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");
const SyncService = require("../services/SyncService");

const sendOrdersItemsToDb = async (req, res) => {
  const { orderId } = req.params;
  const { productList, waiterId, profileId } = req.body;

  if (!orderId || !productList || productList.length === 0) {
    return res
      .status(400)
      .json({ message: "orderId or productList is empty!", data: {} });
  }

  try {
    // insert / updates items
    const savedItems = [];
    for (const item of productList) {
      const existingItem = await OrdersItemsModel.findOne({
        where: {
          order_id: orderId,
          product_id: item.id,
        },
      });

      if (existingItem) {
        // Update existing item (increment count and update price)
        existingItem.count += Number(item.quantity || 0);
        existingItem.price = item.price;
        existingItem.operator_id = waiterId;
        await existingItem.save();
        savedItems.push(existingItem);
      } else {
        // Create new item
        const newItem = await OrdersItemsModel.create({
          order_id: orderId,
          product_id: item.id,
          count: item.quantity,
          price: item.price,
          operator_id: waiterId,
          profile_id: profileId,
        });
        savedItems.push(newItem);
      }
    }

    // All order on backend
    const listOfProducts = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price"],
    });

    // Calc total (Robust)
    const total = listOfProducts.reduce((sum, item) => {
      const qty = parseFloat(item.count) || 0;
      const prc = parseFloat(item.price) || 0;
      return sum + qty * prc;
    }, 0);

    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: [
        "discount_value",
        "discount_type",
        "service_value",
        "service_type",
        "deposit",
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
          service = (total * sValue) / 100;
        } else if (service_type === "cash") {
          service = sValue;
        }
      }
    }

    let netTotal = total - discount + service + deposit;
    netTotal = Math.max(netTotal, 0);

    // Order update
    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0
      },
      { where: { uuid: orderId } },
    );

    // Sync trigger
    SyncService.triggerSync(orderId);

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
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

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

  try {
    const listOfProducts = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price"],
    });

    if (!listOfProducts || listOfProducts.length === 0) {
      return res.status(404).json({ message: "Order items not found" });
    }

    const total = listOfProducts.reduce(
      (sum, item) => sum + Number(item.count) * Number(item.price),
      0,
    );

    discountValue = Number(discountValue);

    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(400).json({ message: "Invalid discount value" });
    }

    let discount = 0;
    let newTotal = total;

    // Fetch current service and deposit to keep them in total
    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: ["service_charge", "deposit"],
    });
    const serviceCharge = parseFloat(currentOrder?.service_charge || 0);
    const deposit = parseFloat(currentOrder?.deposit || 0);

    if (discountType === "percent") {
      discount = (total * discountValue) / 100;
    } else if (discountType === "cash") {
      discount = discountValue;
    } else {
      return res.status(400).json({ message: "Invalid discount type" });
    }

    newTotal = total - discount + serviceCharge + deposit;

    newTotal = Math.max(newTotal, 0);

    await OrdersModel.update(
      {
        discount: discount,
        total: newTotal,
        discount_type: discountType,
        discount_value: discountValue,
        is_synced: 0
      },
      { where: { uuid: orderId } },
    );

    SyncService.triggerSync(orderId);

    return res.status(200).json({
      message: "Discount updated successfully!",
      data: { total, discount, newTotal, discountType, discountValue },
    });
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

  try {
    const listOfProducts = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price"],
    });

    if (!listOfProducts || listOfProducts.length === 0) {
      return res.status(404).json({ message: "Order items not found" });
    }

    const total = listOfProducts.reduce(
      (sum, item) => sum + Number(item.count) * Number(item.price),
      0,
    );

    serviceValue = Number(serviceValue);

    if (isNaN(serviceValue) || serviceValue < 0) {
      return res.status(400).json({ message: "Invalid service value" });
    }

    let service = 0;
    let newTotal = total;

    // Fetch current discount and deposit to keep them in total
    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: ["discount", "deposit"],
    });
    const discountAmount = parseFloat(currentOrder?.discount || 0);
    const deposit = parseFloat(currentOrder?.deposit || 0);

    if (feeType === "percent") {
      service = (total * serviceValue) / 100;
    } else if (feeType === "cash") {
      service = serviceValue;
    } else {
      return res.status(400).json({ message: "Invalid service type" });
    }

    newTotal = total + service - discountAmount + deposit;

    newTotal = Math.max(newTotal, 0);

    await OrdersModel.update(
      {
        service_charge: service,
        total: newTotal,
        service_type: feeType,
        service_value: serviceValue,
        is_synced: 0
      },
      { where: { uuid: orderId } },
    );

    SyncService.triggerSync(orderId);

    return res.status(200).json({
      message: "service updated successfully!",
      data: { total, service, newTotal, feeType, serviceValue },
    });
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

    SyncService.triggerSync(orderId);

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

    SyncService.triggerSync(orderId);

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
    const updateTags = await OrdersModel.update(
      { tags: tags, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    SyncService.triggerSync(orderId);
    res.status(200).json({ message: "tags update" });
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
    const updateComments = await OrdersModel.update(
      { note: comments, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    SyncService.triggerSync(orderId);
    res.status(200).json({ message: "comment update" });
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
    const deleteItems = await OrdersItemsModel.destroy({
      where: { order_id: orderId },
    });
    const updateTotal = await OrdersModel.update(
      { total: 0 },
      {
        where: { uuid: orderId },
      },
    );
    await OrdersModel.update({ is_synced: 0 }, { where: { uuid: orderId } });
    SyncService.triggerSync(orderId);
    res.status(200).json({ message: "delete all items" });
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

    const { discount_value, discount_type, service_value, service_type } =
      currentOrder;

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

    // Recalculate Totals based on merged items
    // 1) Subtotal (sum of all prices * count)
    const subtotal = itemsToCreate.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      const count = parseFloat(item.count) || 0;
      return sum + price * count;
    }, 0);

    // 2) Discount total
    let discountAmount = 0;
    const dValue = Number(discount_value || 0);
    if (dValue > 0) {
      if (discount_type === "percent") {
        discountAmount = (subtotal * dValue) / 100;
      } else {
        discountAmount = dValue;
      }
    }

    // 3) Service charge total
    let serviceCharge = 0;
    const sValue = Number(service_value || 0);
    if (sValue > 0) {
      if (service_type === "percent") {
        serviceCharge = (subtotal * sValue) / 100;
      } else {
        serviceCharge = sValue;
      }
    }

    // Final total
    let total = subtotal - discountAmount + serviceCharge;
    total = Math.max(total, 0);

    // Update the order
    await OrdersModel.update(
      {
        amount: subtotal,
        discount: discountAmount,
        service_charge: serviceCharge,
        total: total,
      },
      { where: { uuid: currentOrderId }, transaction },
    );

    // Delete the merged (old) order
    await OrdersModel.destroy({
      where: { uuid: newOrderId },
      transaction,
    });

    // Commit
    await transaction.commit();

    SyncService.triggerSync(currentOrderId);
    // newOrderId is deleted, but we might want to sync that deletion too? 
    // Usually handled by sending the deleted order as status=0/deleted. 
    // Here we physically destroy the record. Admin sync might need to know about deletion.
    // However, user requirement mentions syncing operations on check.
    // For now, syncing the currentOrderId is critical.

    return res.status(200).json({
      message: "Merge success",
      data: {
        amount: subtotal,
        discount: discountAmount,
        service_charge: serviceCharge,
        total: total,
      },
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
    const updateSaleType = await OrdersModel.update(
      { sale_type: saleType, table_id: tableId, hall_id: hallId, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    SyncService.triggerSync(orderId);
    res.status(200).json({ message: "sale-type  update" });
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
    const updateWaiter = await OrdersModel.update(
      { waiter_id: waiterId, is_synced: 0 },
      { where: { uuid: orderId } },
    );
    SyncService.triggerSync(orderId);
    res.status(200).json({ message: "waiter  update" });
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
      const maxId = await OrdersModel.max("id", { paranoid: false });
      const newId = (maxId || 0) + 1;

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
      const originalItem = await OrdersItemsModel.findOne({
        where: { order_id: data.orderId, product_id: item.id },
        transaction,
      });

      if (originalItem) {
        const moveQty = Number(item.qty);
        // Reduce from original
        if (originalItem.count > moveQty) {
          originalItem.count -= moveQty;
          await originalItem.save({ transaction });
        } else {
          await originalItem.destroy({ transaction });
        }

        // Add to Target Order
        const existingTargetItem = await OrdersItemsModel.findOne({
          where: { order_id: targetOrder.uuid, product_id: item.id },
          transaction,
        });

        if (existingTargetItem) {
          existingTargetItem.count = Number(existingTargetItem.count) + moveQty;
          await existingTargetItem.save({ transaction });
        } else {
          await OrdersItemsModel.create(
            {
              order_id: targetOrder.uuid,
              product_id: item.id,
              count: moveQty,
              price: originalItem.price,
              operator_id: targetOrder.waiter_id,
              profile_id: profileId,
            },
            { transaction },
          );
        }
      }
    }

    const recalculateOrder = async (orderId, targetTransaction) => {
      const items = await OrdersItemsModel.findAll({
        where: { order_id: orderId },
        attributes: ["count", "price"],
        transaction: targetTransaction,
      });

      const totalAmount = items.reduce(
        (sum, it) => sum + Number(it.count) * Number(it.price),
        0,
      );

      const ord = await OrdersModel.findOne({
        where: { uuid: orderId },
        transaction: targetTransaction,
      });

      if (!ord) return;

      let discount = 0;
      let service = 0;

      if (Number(ord.discount_value) > 0) {
        if (ord.discount_type === "percent") {
          discount = (totalAmount * Number(ord.discount_value)) / 100;
        } else {
          discount = Number(ord.discount_value);
        }
      }

      if (Number(ord.service_value) > 0) {
        if (ord.service_type === "percent") {
          service = (totalAmount * Number(ord.service_value)) / 100;
        } else {
          service = Number(ord.service_value);
        }
      }

      let netTotal = totalAmount - discount + service;
      netTotal = Math.max(netTotal, 0);

      await OrdersModel.update(
        {
          amount: totalAmount,
          discount: discount,
          service_charge: service,
          total: netTotal,
        },
        { where: { uuid: orderId }, transaction: targetTransaction },
      );
    };

    await recalculateOrder(data.orderId, transaction);
    await recalculateOrder(targetOrder.uuid, transaction);

    await transaction.commit();

    SyncService.triggerSync(data.orderId);
    SyncService.triggerSync(targetOrder.uuid);

    res.status(200).json({
      message: "success",
      data: {
        newOrder: targetOrder,
        status: isMerge ? "merged" : "created",
        profile,
        profileId,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Split Order Error:", error);
    res.status(500).json({ message: "Split failed", error: error.message });
  }
};

const onGiftItem = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, qty, isGift } = req.body;

  if (!orderId || !itemId || !qty) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const transaction = await sequelize.transaction();

  try {
    const originalItem = await OrdersItemsModel.findOne({
      where: { order_id: orderId, product_id: itemId, is_gift: isGift ? 0 : 1 },
      transaction,
    });

    if (!originalItem) {
      throw new Error("Item not found or quantity invalid");
    }

    const moveQty = Number(qty);
    if (originalItem.count < moveQty) {
      throw new Error("Invalid quantity");
    }

    // 1. Reduce count from original item or destroy if fully moved
    if (Number(originalItem.count) === moveQty) {
      await originalItem.destroy({ transaction });
    } else {
      originalItem.count = Number(originalItem.count) - moveQty;
      await originalItem.save({ transaction });
    }

    // 2. Add to Target Item (Gift or Normal)
    const targetIsGift = isGift ? 1 : 0;
    const targetItem = await OrdersItemsModel.findOne({
      where: { order_id: orderId, product_id: itemId, is_gift: targetIsGift },
      transaction,
    });

    if (targetItem) {
      targetItem.count = Number(targetItem.count) + moveQty;

      if (targetIsGift === 1) {
        targetItem.price = 0;
      } else {
        // Restore price - wait, if original was gift, it had price 0. Steps: Find product.
        const product = await OrdersItemsModel.findOne({
          where: { order_id: orderId, product_id: itemId, is_gift: 0 },
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
          where: { order_id: orderId, product_id: itemId, is_gift: 0 },
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
          product_id: itemId,
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
      attributes: ["count", "price"],
      transaction,
    });

    const total = allItems.reduce((sum, item) => {
      const qty = parseFloat(item.count) || 0;
      const prc = parseFloat(item.price) || 0;
      return sum + qty * prc;
    }, 0);

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
            ? (total * globServVal) / 100
            : globServVal;
      }
    }

    let netTotal = total - discount + service;
    if (netTotal < 0) netTotal = 0;

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount,
        service_charge: service,
        is_synced: 0
      },
      { where: { uuid: orderId }, transaction },
    );

    // Sync trigger
    SyncService.triggerSync(orderId);

    await transaction.commit();

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
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: "Error", error: error.message });
  }
};

const onUpdateItemDiscount = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, discountValue, discountType } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const item = await OrdersItemsModel.findOne({
      where: { order_id: orderId, product_id: itemId, is_gift: 0 },
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
      attributes: ["count", "price"],
      transaction,
    });

    const total = allItems.reduce((sum, item) => {
      const qty = parseFloat(item.count) || 0;
      const prc = parseFloat(item.price) || 0;
      return sum + qty * prc;
    }, 0);

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
            ? (total * globServVal) / 100
            : globServVal;
      }
    }

    let netTotal = total - discount + service;
    if (netTotal < 0) netTotal = 0;

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0
      },
      { where: { uuid: orderId }, transaction },
    );

    // Sync trigger
    SyncService.triggerSync(orderId);

    await transaction.commit();

    // Fetch and return logic continues...

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Discount Error:", error);
    res.status(500).json({ message: "Error", error: error.message });
  }
};

const onDeleteCheck = async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const updateCheckStatus = await OrdersModel.update(
      { status: 3, end_date: new Date(), is_synced: 0 },
      { where: { uuid: orderId } },
    );
    SyncService.triggerSync(orderId);
    res.status(200).json({ message: "success" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const onCloseOrder = async (req, res) => {
  const { orderId } = req.params;
  const { payments, status, profileId, waiterId, note } = req.body;

  if (!orderId || !status || !profileId || !waiterId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const transaction = await sequelize.transaction();

  try {
    // 1. Update Order Status, Note, and End Date
    await OrdersModel.update(
      { status: status, note: note || "", end_date: new Date(), is_synced: 0 },
      { where: { uuid: orderId }, transaction },
    );

    // 2. Insert Payments if provided
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
      }));

      await OrderPaymentsModel.bulkCreate(paymentRecords, { transaction });
    }

    await transaction.commit();
    SyncService.triggerSync(orderId);
    res.status(200).json({ message: "Order closed successfully" });
  } catch (error) {
    if (transaction) await transaction.rollback();
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

    const newTotal = Math.max(
      amount - discount + service_charge + depositValue,
      0,
    );

    await OrdersModel.update(
      {
        deposit: depositValue,
        total: newTotal,
        is_synced: 0
      },
      { where: { uuid: orderId } },
    );

    SyncService.triggerSync(orderId);

    return res.status(200).json({
      message: "Deposit updated successfully!",
      data: { depositValue, total: newTotal },
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
        is_synced: 0
      },
      { where: { uuid: orderId } }
    );
    SyncService.triggerSync(orderId);

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
        is_synced: 0
      },
      { where: { uuid: orderId } }
    );
    SyncService.triggerSync(orderId);

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
    return res.status(400).json({ message: "Missing required fields" });
  }

  const transaction = await sequelize.transaction();

  try {
    const item = await OrdersItemsModel.findOne({
      where: { order_id: orderId, product_id: itemId, is_gift: 0 },
      transaction,
    });

    if (!item) {
      throw new Error("Item not found");
    }

    console.log(`[DELETE REASON] Order: ${orderId}, Item: ${itemId}, Reason: ${reasonId}, Qty: ${qty || 'ALL'}`);

    if (qty && qty > 0 && qty < item.count) {
      // Partial delete
      item.count -= qty;
      await item.save({ transaction });
    } else {
      // Full delete
      await item.destroy({ transaction });
    }

    // Recalculate totals
    const allItems = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price"],
      transaction,
    });

    const total = allItems.reduce((sum, it) => {
      const q = parseFloat(it.count) || 0;
      const p = parseFloat(it.price) || 0;
      return sum + q * p;
    }, 0);

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
        discount = ord.discount_type === "percent" ? (total * dVal) / 100 : dVal;
      }
      if (sVal > 0) {
        service = ord.service_type === "percent" ? (total * sVal) / 100 : sVal;
      }
    }

    let netTotal = Math.max(0, total - discount + service);

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount,
        service_charge: service,
        is_synced: 0
      },
      { where: { uuid: orderId }, transaction }
    );
    // Sync handled after commit
    SyncService.triggerSync(orderId);

    await transaction.commit();

    // Return updated order
    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] },
          ],
        },
      ],
    });

    res.status(200).json(updatedOrder);

  } catch (error) {
    await transaction.rollback();
    console.error("Delete Item Error:", error);
    res.status(500).json({ message: "Error deleting item", error: error.message });
  }
};

const onUpdateItemPrice = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, newPrice } = req.body;

  try {
    const item = await OrdersItemsModel.findOne({
      where: {
        order_id: orderId,
        id: itemId
      }
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
      attributes: ["count", "price"],
    });

    // 2. Calculate raw total
    const total = listOfProducts.reduce((sum, item) => {
      const qty = parseFloat(item.count) || 0;
      const prc = parseFloat(item.price) || 0;
      return sum + qty * prc;
    }, 0);

    // 3. Get Order details for discount/service/deposit
    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: [
        "discount_value",
        "discount_type",
        "service_value",
        "service_type",
        "deposit",
      ],
    });

    let discount = 0;
    let service = 0;
    const deposit = parseFloat(currentOrder?.deposit || 0);

    if (currentOrder) {
      const { discount_value, discount_type, service_value, service_type } = currentOrder;
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
          service = (total * sValue) / 100;
        } else if (service_type === "cash") {
          service = sValue;
        }
      }
    }

    let netTotal = total - discount + service + deposit;
    netTotal = Math.max(netTotal, 0);

    // 4. Update OrdersModel
    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0
      },
      { where: { uuid: orderId } },
    );
    SyncService.triggerSync(orderId);

    // Return success with necessary data for frontend updates
    res.status(200).json({
      message: "success",
      itemId,
      newPrice: item.price,
      uuid: orderId, // Critical for TablesSlice matcher
      total: netTotal,
      amount: total,
      discount,
      service_charge: service
    });

  } catch (error) {
    console.error("Update Price Error:", error);
    res.status(500).json({ message: "Error updating price", error: error.message });
  }
};

const onUpdateItemCount = async (req, res) => {
  const { orderId } = req.params;
  const { itemId, newCount } = req.body;

  if (!orderId || !itemId || newCount === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const item = await OrdersItemsModel.findOne({
      where: {
        order_id: orderId,
        product_id: itemId,
        is_gift: 0
      }
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    item.count = parseInt(newCount);
    await item.save();

    // Recalculate Order Total
    const listOfProducts = await OrdersItemsModel.findAll({
      where: { order_id: orderId },
      attributes: ["count", "price"],
    });

    const total = listOfProducts.reduce((sum, it) => {
      const qty = parseFloat(it.count) || 0;
      const prc = parseFloat(it.price) || 0;
      return sum + qty * prc;
    }, 0);

    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: [
        "discount_value",
        "discount_type",
        "service_value",
        "service_type",
        "deposit",
      ],
    });

    let discount = 0;
    let service = 0;
    const deposit = parseFloat(currentOrder?.deposit || 0);

    if (currentOrder) {
      const { discount_value, discount_type, service_value, service_type } = currentOrder;
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
          service = (total * sValue) / 100;
        } else if (service_type === "cash") {
          service = sValue;
        }
      }
    }

    let netTotal = total - discount + service + deposit;
    netTotal = Math.max(netTotal, 0);

    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
        is_synced: 0
      },
      { where: { uuid: orderId } },
    );
    SyncService.triggerSync(orderId);

    res.status(200).json({
      message: "success",
      itemId,
      newCount: item.count,
      uuid: orderId,
      total: netTotal,
      amount: total,
      discount,
      service_charge: service
    });

  } catch (error) {
    console.error("Update Count Error:", error);
    res.status(500).json({ message: "Error updating count", error: error.message });
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
  onUpdateItemCount,
};

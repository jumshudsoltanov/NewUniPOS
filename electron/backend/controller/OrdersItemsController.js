const { sequelize } = require("../database/config");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const OrdersModel = require("../model/OrdersModel");

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

    // Calc total
    const total = listOfProducts.reduce(
      (sum, item) => sum + Number(item.count) * Number(item.price),
      0,
    );

    // Get current order discount info to recalculate
    const currentOrder = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: [
        "discount_value",
        "discount_type",
        "service_value",
        "service_type",
      ],
    });

    let discount = 0;
    let service = 0;

    if (currentOrder) {
      const { discount_value, discount_type, service_value, service_type } =
        currentOrder;
      const dValue = Number(discount_value || 0);
      const sValue = Number(service_value || 0);

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

    let netTotal = total - discount + service;
    netTotal = Math.max(netTotal, 0);

    // Order update
    await OrdersModel.update(
      {
        amount: total,
        total: netTotal,
        discount: discount,
        service_charge: service,
      },
      { where: { uuid: orderId } },
    );

    return res
      .status(201)
      .json({ message: "Orders items saved successfully!", data: savedItems });
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

    if (discountType === "percent") {
      discount = (total * discountValue) / 100;
    } else if (discountType === "cash") {
      discount = discountValue;
    } else {
      return res.status(400).json({ message: "Invalid discount type" });
    }

    newTotal = total - discount;

    newTotal = Math.max(newTotal, 0);

    await OrdersModel.update(
      {
        discount: discount,
        total: newTotal,
        discount_type: discountType,
        discount_value: discountValue,
      },
      { where: { uuid: orderId } },
    );

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

    if (feeType === "percent") {
      service = (total * serviceValue) / 100;
    } else if (feeType === "cash") {
      service = serviceValue;
    } else {
      return res.status(400).json({ message: "Invalid service type" });
    }

    newTotal = total + service;

    newTotal = Math.max(newTotal, 0);

    await OrdersModel.update(
      {
        service_charge: service,
        total: newTotal,
        service_type: feeType,
        service_value: serviceValue,
      },
      { where: { uuid: orderId } },
    );

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
      { hall_id: currentHallId, table_id: newTableId },
      { where: { uuid: orderId } },
    );

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
      { is_locked: status },
      { where: { uuid: orderId } },
    );

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
      { tags: tags },
      { where: { uuid: orderId } },
    );
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
      { note: comments },
      { where: { uuid: orderId } },
    );
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
      { sale_type: saleType, table_id: tableId, hall_id: hallId },
      { where: { uuid: orderId } },
    );
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
      { waiter_id: waiterId },
      { where: { uuid: orderId } },
    );
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

    // 2. Create New Order
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

    const newOrder = await OrdersModel.create(
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

    for (const item of data.items) {
      const originalItem = await OrdersItemsModel.findOne({
        where: { order_id: data.orderId, product_id: item.id },
        transaction,
      });

      if (originalItem) {
        const moveQty = Number(item.qty);
        if (originalItem.count > moveQty) {
          originalItem.count -= moveQty;
          await originalItem.save({ transaction });
        } else {
          await originalItem.destroy({ transaction });
        }

        await OrdersItemsModel.create({
          order_id: newOrder.uuid,
          product_id: item.id,
          count: moveQty,
          price: originalItem.price,
          operator_id: newOrder.waiter_id,
          profile_id: profileId,
        }, { transaction });
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
        0
      );

      const ord = await OrdersModel.findOne({
        where: { uuid: orderId },
        transaction: targetTransaction
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

      await OrdersModel.update({
        amount: totalAmount,
        discount: discount,
        service_charge: service,
        total: netTotal
      }, { where: { uuid: orderId }, transaction: targetTransaction });
    };

    await recalculateOrder(data.orderId, transaction);
    await recalculateOrder(newOrder.uuid, transaction);

    await transaction.commit();

    res.status(200).json({
      message: "success",
      data: {
        newOrder,
        profile,
        profileId
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Split Order Error:", error);
    res.status(500).json({ message: "Split failed", error: error.message });
  }
};

module.exports = {
  sendOrdersItemsToDb,
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
};

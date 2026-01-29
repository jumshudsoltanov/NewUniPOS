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
    const ordersItemsData = productList.map((item) => ({
      order_id: orderId,
      product_id: item.id,
      count: item.quantity,
      price: item.price,
      operator_id: waiterId,
      profile_id: profileId,
    }));

    // insert / updates items
    const savedItems = await OrdersItemsModel.bulkCreate(ordersItemsData, {
      updateOnDuplicate: ["count", "price", "product_id", "order_id"],
    });

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

    // Order update
    await OrdersModel.update(
      { amount: total, total: total },
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

module.exports = { sendOrdersItemsToDb, onUpdateDiscountOrder };

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
  const { uuid } = req.params;
  const { discountValue, discountType } = req.body;

  res.status(200).json({
    message: "discount update success",
    data: { uuid, discountType, discountValue },
  });
};

module.exports = { sendOrdersItemsToDb, onUpdateDiscountOrder };

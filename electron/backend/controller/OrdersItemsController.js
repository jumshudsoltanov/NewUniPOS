const OrdersItemsModel = require("../model/OrdersItemsModel");

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

    const savedItems = await OrdersItemsModel.bulkCreate(ordersItemsData, {
      updateOnDuplicate: ["count", "price"],
    });

    return res
      .status(201)
      .json({ message: "Orders items saved successfully!", data: savedItems });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", data: error });
  }
};

module.exports = { sendOrdersItemsToDb };

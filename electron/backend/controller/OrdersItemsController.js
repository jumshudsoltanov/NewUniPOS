const sendOrdersItemsToDb = async (req, res) => {
  const { orderId } = req.params;
  const { productList } = req.body;
  res.status(200).json({ message: "success", data: { orderId, productList } });
};

module.exports = { sendOrdersItemsToDb };

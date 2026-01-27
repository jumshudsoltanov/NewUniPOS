const OrdersModel = require("../model/OdersModel");

const CreateNewOrders = async (req, res) => {
  try {
    const data = req.body;

    if (!data.id) {
      res.status(400).json({ message: "false", data: "Required table id" });
      return;
    }
    let { count } = await OrdersModel.findAndCountAll();
    let newSale = await OrdersModel.create({
      id: count + 1,
      table_id: data.id,
    });

    res.status(200).json({ message: "success", data: newSale, count: count });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

module.exports = { CreateNewOrders };

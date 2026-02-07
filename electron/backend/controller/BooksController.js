const OrdersModel = require("../model/OrdersModel");
const WaitersModel = require("../model/WaitersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");

const getAllActiveOrders = async (req, res) => {
  const { profileId } = req.params;

  try {
    const orders = await OrdersModel.findAll({
      where: { profile_id: profileId, status: 1 },
      order: [["start_date", "DESC"]],
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]]
        },
        {
          model: OrderPaymentsModel,
          as: "order_payments",
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] }
          ]
        },
      ],
    });

    res.status(200).json({ message: "success", data: orders });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", data: {} });
  }
};

module.exports = { getAllActiveOrders };

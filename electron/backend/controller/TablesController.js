const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const OrdersModel = require("../model/OrdersModel");
const WaitersModel = require("../model/WaitersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const ProductsModel = require("../model/ProductsModel");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");

const getTables = async (req, res) => {
  const { profileId } = req.params;
  try {
    const tables = await TableGroupsModel.findAll({
      where: { profile_id: profileId },
      include: {
        model: TablesModel,
        include: {
          model: OrdersModel,
          where: { status: 1 },
          required: false,
          include: [
            {
              model: WaitersModel,
              as: "waiter",
              attributes: ["id", "name"],
            },
            {
              model: OrdersItemsModel,
              as: "orders_items",
              include: [
                {
                  model: ProductsModel,
                  as: "product",
                  attributes: ["id", "name"],
                },
              ],
            },
            {
              model: OrderPaymentsModel,
              as: "order_payments",
            },
          ],
          as: "orders",
        },
      },
      order: [
        ["ordering", "ASC"],
        [TablesModel, "id", "ASC"],
      ],
    });
    if (tables.length === 0) {
      res
        .status(200)
        .json({ message: "false", data: "tables or halls not found" });
      return;
    }

    res.status(200).json({ message: "success", data: tables });
  } catch (error) {
    console.error("Tables Controller Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getTables };

const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const OrdersModel = require("../model/OrdersModel");
const WaitersModel = require("../model/WaitersModel");

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
          attributes: ["id", "uuid", "amount", "discount", "deposit", "service_charge", "print_count", "waiter_id", "status", "guest_count"],
          include: [
            {
              model: WaitersModel,
              as: "waiter",
              attributes: ["id", "name"],
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

    res.status(200).json({ message: "success", data: tables });
  } catch (error) {
    console.error("Tables Controller Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getTables };

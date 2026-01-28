const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const OrdersModel = require("../model/OdersModel");
const WaitersModel = require("../model/WaitersModel");

const getTables = async (req, res) => {
  const { profileId } = req.params;
  try {
    const tables = await TableGroupsModel.findAll({
      where: { profile_id: profileId, status: 1 },
      include: {
        model: TablesModel,
        include: {
          model: OrdersModel,
          include: {
            model: WaitersModel,
            as: "waiter",
          },
          as: "orders",
        },
      },
    });
    if (tables.length === 0) {
      res
        .status(200)
        .json({ message: "false", data: "tables or halls not found" });
      return;
    }

    res.status(200).json({ message: "success", data: tables });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getTables };

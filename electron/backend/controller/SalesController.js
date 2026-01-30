const OrdersModel = require("../model/OrdersModel");

const CreateNewOrders = async (req, res) => {
  try {
    const {
      guestCount,
      tableId,
      waiterId,
      terminalId,
      profileId,
      sale_type,
      hallId,
      status,
      is_selected,
    } = req.body;

    if (!tableId) {
      res.status(400).json({ message: "false", data: "Required table id" });
      return;
    }
    let { count } = await OrdersModel.findAndCountAll();
    let newSale = await OrdersModel.create({
      id: count + 1,
      table_id: tableId ?? 0,
      guest_count: guestCount ?? 0,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: sale_type,
      hall_id: hallId ?? 0,
      status: status,
      is_selected: is_selected,
    });

    res.status(200).json({ message: "success", data: newSale, count: count });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

const CreateNewOtherOrders = async (req, res) => {
  try {
    const {
      waiterId,
      terminalId,
      profileId,
      sale_type,
      status,
      is_selected,
    } = req.body;

    if (!profileId && !sale_type) {
      res.status(400).json({ message: "false", data: "Required table id" });
      return;
    }
    let { count } = await OrdersModel.findAndCountAll();
    let newSale = await OrdersModel.create({
      id: count + 1,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: sale_type,
      status: status,
      is_selected: is_selected,
    });

    res.status(200).json({ message: "success", data: newSale, count: count });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

module.exports = { CreateNewOrders,CreateNewOtherOrders };

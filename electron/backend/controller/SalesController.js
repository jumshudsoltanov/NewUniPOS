const OrdersModel = require("../model/OrdersModel");
const SyncService = require("../services/SyncService");

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
      serviceValue,
      serviceType,
    } = req.body;

    if (!tableId || !waiterId || !terminalId || !profileId) {
      res.status(400).json({
        message: "false",
        data: "Required fields missing (table, waiter, terminal, or profile)",
      });
      return;
    }

    // Use MAX(id) + 1 to avoid conflicts with deleted rows
    const maxId = await OrdersModel.max("id", { paranoid: false });
    const newId = (maxId || 0) + 1;

    // Check if the table has a deposit
    const table = await require("../model/TablesModel").findOne({
      where: { id: tableId },
    });

    let newSale = await OrdersModel.create({
      id: newId,
      table_id: tableId ?? 0,
      guest_count: guestCount ?? 0,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: sale_type,
      hall_id: hallId ?? 0,
      status: status,
      is_selected: is_selected,
      service_type: serviceType,
      service_value: serviceValue,
      deposit: table?.deposit || 0, // Include table deposit if exists
      is_synced: 0 // Mark as unsynced initially
    });

    // Trigger sync
    if (newSale.uuid) {
      SyncService.triggerSync(newSale.uuid);
    }

    res.status(200).json({ message: "success", data: newSale, count: newId });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

const CreateNewOtherOrders = async (req, res) => {
  try {
    const { waiterId, terminalId, profileId, sale_type, status, is_selected } =
      req.body;

    if (!profileId || !sale_type || !waiterId || !terminalId) {
      res
        .status(400)
        .json({ message: "false", data: "Required fields missing" });
      return;
    }

    // Use MAX(id) + 1 to avoid conflicts with deleted rows
    const maxId = await OrdersModel.max("id", { paranoid: false });
    const newId = (maxId || 0) + 1;

    let newSale = await OrdersModel.create({
      id: newId,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: sale_type,
      status: status,
      is_selected: is_selected,
      is_synced: 0
    });

    // Trigger sync
    if (newSale.uuid) {
      SyncService.triggerSync(newSale.uuid);
    }

    res.status(200).json({ message: "success", data: newSale, count: newId });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

module.exports = { CreateNewOrders, CreateNewOtherOrders };

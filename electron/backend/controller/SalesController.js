const OrdersModel = require("../model/OrdersModel");
const SyncService = require("../services/SyncService");
const MaxCheckService = require("../services/MaxCheckService");

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
      uuid,
    } = req.body;

    if (!tableId || !waiterId || !terminalId || !profileId) {
      res.status(400).json({
        message: "false",
        data: "Required fields missing (table, waiter, terminal, or profile)",
      });
      return;
    }

    const newId = await MaxCheckService.getNextId(profileId);

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
      status: status ?? 1,
      is_selected: is_selected ?? 1,
      service_type: serviceType,
      service_value: serviceValue,
      deposit: table?.deposit || 0,
      is_synced: 0,
      uuid: uuid || undefined,
    });

    // Trigger sync
    if (newSale.uuid) {
      SyncService.triggerSync(newSale.uuid);
      const { getIo } = require("../socket/MasterServer");
      if (getIo()) getIo().emit("table_updated", { orderId: newSale.uuid });
    }

    res.status(200).json({ message: "success", data: newSale, count: newId });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

const CreateNewOtherOrders = async (req, res) => {
  try {
    const { waiterId, terminalId, profileId, sale_type, status, is_selected, uuid } =
      req.body;

    if (!profileId || !sale_type || !waiterId || !terminalId) {
      res
        .status(400)
        .json({ message: "false", data: "Required fields missing" });
      return;
    }

    const newId = await MaxCheckService.getNextId(profileId);

    let newSale = await OrdersModel.create({
      id: newId,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: sale_type,
      status: status ?? 1,
      status: status ?? 1,
      is_selected: is_selected ?? 1,
      is_synced: 0,
      uuid: uuid || undefined,
    });

    // Trigger sync
    if (newSale.uuid) {
      SyncService.triggerSync(newSale.uuid);
      const { getIo } = require("../socket/MasterServer");
      if (getIo()) getIo().emit("table_updated", { orderId: newSale.uuid });
    }

    res.status(200).json({ message: "success", data: newSale, count: newId });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

module.exports = { CreateNewOrders, CreateNewOtherOrders };

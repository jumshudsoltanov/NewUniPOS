const OrdersModel = require("../model/OrdersModel");
const SyncService = require("../services/SyncService");
const MaxCheckService = require("../services/MaxCheckService");
const PreDeletedOrders = require("../services/PreDeletedOrders");

const getNextOrderId = async (req, res) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      res.status(400).json({ message: "false", data: "profileId required" });
      return;
    }
    const nextId = await MaxCheckService.getNextId(profileId);
    res.status(200).json({ message: "success", data: { nextId } });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

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
      id: clientId,
    } = req.body;

    if (!tableId || !waiterId || !terminalId || !profileId) {
      res.status(400).json({
        message: "false",
        data: "Required fields missing (table, waiter, terminal, or profile)",
      });
      return;
    }

    const newId = clientId && Number(clientId) > 0 ? Number(clientId) : await MaxCheckService.getNextId(profileId);

    // If client provided its own ID, report it so server max stays in sync
    if (clientId && Number(clientId) > 0) {
      MaxCheckService.reportUsedId(profileId, clientId);
    }

    const [table, profile] = await Promise.all([
      require("../model/TablesModel").findOne({ where: { id: tableId } }),
      require("../model/LoginModel").findOne({ where: { id: profileId } }),
    ]);

    // Auto-start timer on order creation if table has hourly_price
    const tableHasHourlyPrice = parseFloat(table?.hourly_price) > 0;

    // Kassir yaratma bitməmiş "Çeki ləğv et" basıbsa — çek dərhal silinmiş (status 3) yazılır
    const preDeleted = uuid ? PreDeletedOrders.consume(uuid) : null;
    if (preDeleted) {
      console.log(`[CREATE_ORDER] uuid əvvəlcədən silinib, status=3 ilə yazılır: ${uuid}`);
    }

    let newSale = await OrdersModel.create({
      id: newId,
      table_id: tableId ?? 0,
      guest_count: guestCount ?? 0,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: sale_type,
      hall_id: hallId ?? 0,
      status: preDeleted ? 3 : (status ?? 1),
      ...(preDeleted ? { end_date: new Date(), is_delete_reason_id: preDeleted.reason ?? 0 } : {}),
      is_selected: is_selected ?? 1,
      service_type: serviceType,
      service_value: serviceValue,
      deposit: table?.deposit || 0,
      is_synced: preDeleted ? 0 : 1,
      is_timer_status: !preDeleted && tableHasHourlyPrice ? 1 : 0,
      timer_last_started_at: !preDeleted && tableHasHourlyPrice ? new Date() : null,
      is_active_timer: !preDeleted && tableHasHourlyPrice ? 1 : 0,
      is_timer_clock: "00:00:00",
      rate_per_minute: 0,
      uuid: uuid || undefined,
    });

    if (newSale.uuid) {
      const { getIo } = require("../socket/MasterServer");
      if (getIo()) getIo().emit("table_updated", { orderId: newSale.uuid });
    }
    if (preDeleted && newSale.uuid) {
      SyncService.queueSync(newSale.uuid);
    }

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: newSale.uuid },
      include: [
        { model: require("../model/TablesModel"), as: "table" },
        { model: require("../model/WaitersModel"), as: "waiter", attributes: ["id", "name"] },
      ],
    });

    res.status(200).json({ message: "success", data: updatedOrder, count: newId });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

const CreateNewOtherOrders = async (req, res) => {
  try {
    const { waiterId, terminalId, profileId, sale_type, status, is_selected, uuid, id: clientId } =
      req.body;

    if (!profileId || !sale_type || !waiterId || !terminalId) {
      res
        .status(400)
        .json({ message: "false", data: "Required fields missing" });
      return;
    }

    const newId = clientId && Number(clientId) > 0 ? Number(clientId) : await MaxCheckService.getNextId(profileId);

    // If client provided its own ID, report it so server max stays in sync
    if (clientId && Number(clientId) > 0) {
      MaxCheckService.reportUsedId(profileId, clientId);
    }

    let newSale = await OrdersModel.create({
      id: newId,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: sale_type,
      status: status ?? 1,
      status: status ?? 1,
      is_selected: is_selected ?? 1,
      is_synced: 1,
      uuid: uuid || undefined,
    });

    if (newSale.uuid) {
      const { getIo } = require("../socket/MasterServer");
      if (getIo()) getIo().emit("table_updated", { orderId: newSale.uuid });
    }

    const updatedOrder = await OrdersModel.findOne({
      where: { uuid: newSale.uuid },
      include: [
        { model: require("../model/WaitersModel"), as: "waiter", attributes: ["id", "name"] },
      ],
    });

    res.status(200).json({ message: "success", data: updatedOrder, count: newId });
  } catch (error) {
    res.status(500).json({ message: "false", data: error.message });
  }
};

module.exports = { getNextOrderId, CreateNewOrders, CreateNewOtherOrders };

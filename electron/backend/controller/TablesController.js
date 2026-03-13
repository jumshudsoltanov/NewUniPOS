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
          attributes: ["id", "uuid", "amount", "discount", "deposit", "service_charge", "print_count", "waiter_id", "status", "guest_count", "is_timer_status", "is_active_timer", "is_timer_clock", "timer_last_started_at"],
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

    const TimerService = require("../services/TimerService");
    const updatedTables = tables.map(hall => {
      if (hall.tables) {
        hall.tables = hall.tables.map(table => {
          const activeOrder = (table.orders && table.orders.length > 0) ? table.orders[0] : null;
          if (activeOrder && activeOrder.is_timer_status === 1) {
            const liveStatus = TimerService.calculateLiveStatus(activeOrder, table.hourly_price || 0);
            activeOrder.dataValues.rate_per_minute = liveStatus.charge;
            activeOrder.dataValues.is_timer_clock = liveStatus.clockStr;
            
            // Note: activeOrder.amount is pre-timer subtotal
            const itemsTotal = parseFloat(activeOrder.amount) || 0;
            activeOrder.dataValues.total = itemsTotal + liveStatus.charge;
          }
          return table;
        });
      }
      return hall;
    });

    res.status(200).json({ message: "success", data: updatedTables });
  } catch (error) {
    console.error("Tables Controller Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getTables };

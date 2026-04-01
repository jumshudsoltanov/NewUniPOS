const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const OrdersModel = require("../model/OrdersModel");
const WaitersModel = require("../model/WaitersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const ProductsModel = require("../model/ProductsModel");

/** Kombo/modifikator — masa kartı cəmi ilə çek içi uyğun olsun */
function ordersItemLineTotal(it) {
  const q = parseFloat(it.count) || 0;
  const p = parseFloat(it.price) || 0;
  let modifiersPerUnit = 0;
  try {
    let mods = it.modifiers;
    if (typeof mods === "string") mods = JSON.parse(mods);
    if (Array.isArray(mods)) {
      modifiersPerUnit = mods.reduce(
        (sum, mod) => sum + (parseFloat(mod.price) || 0) * (parseFloat(mod.count) || 1),
        0,
      );
    }
  } catch {
    /* ignore */
  }
  return q * (p + modifiersPerUnit);
}

const getTables = async (req, res) => {
  const { profileId } = req.params;
  const { waiter_id } = req.query;
  try {
    const orderWhere = { status: 1 };
    if (waiter_id) orderWhere.waiter_id = waiter_id;
    const tables = await TableGroupsModel.findAll({
      where: { profile_id: profileId },
      include: {
        model: TablesModel,
        include: {
          model: OrdersModel,
          where: orderWhere,
          required: false,
          attributes: [
            "id", "uuid", "amount", "discount", "discount_value", "discount_type", "deposit",
            "service_charge", "service_value", "service_type", "print_count", "waiter_id", "status",
            "guest_count", "is_timer_status", "is_active_timer", "is_timer_clock", "timer_last_started_at",
            "rate_per_minute", "total", "delivery_fee",
          ],
          include: [
            {
              model: WaitersModel,
              as: "waiter",
              attributes: ["id", "name"],
            },
            {
              model: OrdersItemsModel,
              as: "orders_items",
              separate: true,
              order: [["id", "ASC"]],
              attributes: ["count", "price", "product_id", "modifiers"],
              include: [
                {
                  model: ProductsModel,
                  as: "product",
                  attributes: ["hourly_price"],
                },
              ],
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
            const effHp = TimerService.getEffectiveHourlyPrice({
              ...activeOrder.get({ plain: true }),
              table: { hourly_price: table.hourly_price },
              orders_items: activeOrder.orders_items || [],
            });
            const liveStatus = TimerService.calculateLiveStatus(activeOrder, effHp);
            activeOrder.dataValues.rate_per_minute = liveStatus.charge;
            activeOrder.dataValues.is_timer_clock = liveStatus.clockStr;

            // amount DB-də bəzən artıq taymer daxil olur — cəm üçün sətirlər üzrə məhsul cəmi
            const plainItems = activeOrder.orders_items || [];
            const itemsSum =
              Array.isArray(plainItems) && plainItems.length > 0
                ? plainItems.reduce((s, it) => s + ordersItemLineTotal(it), 0)
                : parseFloat(activeOrder.amount) || 0;
            activeOrder.dataValues.total = itemsSum + liveStatus.charge;
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

const updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { shape_type } = req.body;

    if (!shape_type || !["square", "round", "rectangle", "billiard"].includes(shape_type)) {
      return res.status(400).json({ message: "Invalid shape_type" });
    }

    const table = await TablesModel.findByPk(id);
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }

    await table.update({ shape_type });

    const { getIo } = require("../socket/MasterServer");
    if (getIo()) getIo().emit("table_updated", { tableId: id });

    res.status(200).json({ message: "Table updated successfully", data: table });
  } catch (error) {
    console.error("Update Table Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getTables, updateTable };

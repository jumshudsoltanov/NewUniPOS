const OrdersModel = require("../model/OrdersModel");
const WaitersModel = require("../model/WaitersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");
const TimerService = require("../services/TimerService");
const { Op } = require("sequelize");

const getAllActiveOrders = async (req, res) => {
  const { profileId } = req.params;
  const { id, sale_type, waiter_id, hall_id, table_id } = req.query;

  try {
    let whereClause = {
      profile_id: profileId,
      status: 1 // Only active orders
    };

    // Apply filters similar to archived orders
    if (id) whereClause.id = id;
    if (sale_type) whereClause.sale_type = sale_type;
    if (waiter_id) whereClause.waiter_id = waiter_id;
    if (table_id) whereClause.table_id = table_id;

    // Hall filtering setup
    const includeOptions = [
      { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
      {
        model: OrdersItemsModel,
        as: "orders_items",
        separate: true,
        order: [["id", "ASC"]],
        include: [{ model: require("../model/ProductsModel"), as: "product" }]
      },
      {
        model: TablesModel,
        as: "table",
        attributes: ["id", "name", "hall_id", "hourly_price"],
        include: [
          { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] }
        ]
      }
    ];

    if (hall_id) {
      const tableInclude = includeOptions.find(opt => opt.as === "table");
      if (tableInclude) {
        tableInclude.where = { hall_id: hall_id };
      }
    }

    const orders = await OrdersModel.findAll({
      where: whereClause,
      order: [["start_date", "DESC"]],
      include: includeOptions,
    });

    const updatedOrders = orders.map(order => {
      if (order.is_timer_status === 1) {
        const liveStatus = TimerService.calculateLiveStatus(order, TimerService.getEffectiveHourlyPrice(order));
        order.dataValues.rate_per_minute = liveStatus.charge;
        order.dataValues.is_timer_clock = liveStatus.clockStr;
        
        const itemsTotal = (order.orders_items || []).reduce((sum, it) => sum + (parseFloat(it.count) * parseFloat(it.price)), 0);
        const newTotal = itemsTotal + liveStatus.charge;
        
        let discount = parseFloat(order.discount || 0);
        let service = parseFloat(order.service_charge || 0);
        
        if (parseFloat(order.discount_value) > 0) {
          discount = order.discount_type === "percent" ? (newTotal * parseFloat(order.discount_value)) / 100 : parseFloat(order.discount_value);
        }
        if (parseFloat(order.service_value) > 0) {
          service = order.service_type === "percent" ? (newTotal * parseFloat(order.service_value)) / 100 : parseFloat(order.service_value);
        }
        
        order.dataValues.amount = newTotal;
        order.dataValues.total = Math.max(0, newTotal - discount + service);
        order.dataValues.discount = discount;
        order.dataValues.service_charge = service;
      }
      return order;
    });

    res.status(200).json({ message: "success", data: updatedOrders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", data: {} });
  }
};

const getArchivedOrders = async (req, res) => {
  const { profileId } = req.params;
  const { type, date, id, sale_type, waiter_id, hall_id, table_id } = req.query;

  try {
    let whereClause = {
      profile_id: profileId,
      status: { [Op.in]: [2, 3] }
    };

    // Filter by ID
    if (id) {
      whereClause.id = id;
    }

    // Filter by Sale Type
    if (sale_type) {
      whereClause.sale_type = sale_type;
    }

    // Filter by Waiter
    if (waiter_id) {
      whereClause.waiter_id = waiter_id;
    }

    // Filter by Table
    if (table_id) {
      whereClause.table_id = table_id;
    }

    // Filter by specific date if provided, otherwise handle 'offline' (today) logic ONLY if no ID/other specific filters override it?
    // User requirement: "arxiv ceklerde sadece secili tarixin cekleri gorsensin". 
    // So date filter should apply ALONG WITH other filters.
    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      whereClause.start_date = {
        [Op.between]: [selectedDate, nextDay]
      };
    } else if (type === "offline") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      whereClause.start_date = {
        [Op.between]: [today, tomorrow]
      };
    }

    // Hall filtering needs to be done via Table include if hall_id is on Table, or if Order has hall_id directly.
    // Standard POS schema usually has hall_id on Table. So we might need to filter inside include or get table IDs first.
    // For simplicity/performance in Sequelize, simple where on associated model in include:
    const includeOptions = [
      { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
      {
        model: OrdersItemsModel,
        as: "orders_items",
        separate: true,
        order: [["id", "ASC"]],
        include: [{ model: require("../model/ProductsModel"), as: "product" }]
      },
      {
        model: OrderPaymentsModel,
        as: "order_payments",
        include: [
          { model: require("../model/PaymentMethodsModel"), as: "payment_method" },
          { model: require("../model/TagsModel"), as: "tag" }
        ]
      },
      {
        model: TablesModel,
        as: "table",
        attributes: ["id", "name", "hall_id"], // Ensure hall_id is fetched
        include: [
          { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] }
        ]
      }
    ];

    // If filtering by Hall, we add where clause to the Table include
    if (hall_id) {
      // Find the table include and add where
      const tableInclude = includeOptions.find(opt => opt.as === "table");
      if (tableInclude) {
        tableInclude.where = { hall_id: hall_id };
        // Note: This makes it an INNER JOIN, so orders without tables (e.g. delivery) won't show if hall is selected.
        // This is correct behavior for "Filter by Hall".
      }
    }

    const orders = await OrdersModel.findAll({
      where: whereClause,
      order: [["start_date", "DESC"]],
      include: includeOptions
    });

    res.status(200).json({ message: "success", data: orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", data: {} });
  }
};

// Get single order by ID for return check modal
const getOrderById = async (req, res) => {
  const { orderId } = req.params;
  const { profileId } = req.query;

  try {
    // First try to find by numeric ID
    let whereClause = { profile_id: profileId };

    // Check if orderId is numeric (check ID) or UUID
    if (!isNaN(orderId)) {
      whereClause.id = parseInt(orderId);
    } else {
      whereClause.uuid = orderId;
    }

    const order = await OrdersModel.findOne({
      where: whereClause,
      include: [
        { model: WaitersModel, as: "waiter", attributes: ["id", "name"] },
        {
          model: OrdersItemsModel,
          as: "orders_items",
          separate: true,
          order: [["id", "ASC"]],
          include: [{ model: require("../model/ProductsModel"), as: "product" }]
        },
        {
          model: OrderPaymentsModel,
          as: "order_payments",
          include: [
            { model: require("../model/PaymentMethodsModel"), as: "payment_method" },
            { model: require("../model/TagsModel"), as: "tag" }
          ]
        },
        {
          model: TablesModel,
          as: "table",
          attributes: ["id", "name", "hall_id", "hourly_price"],
          include: [
            { model: TableGroupsModel, as: "hall", attributes: ["id", "name"] }
          ]
        }
      ]
    });

    if (order) {
      // Automatic timer calculation for active timers
      if (order.is_timer_status === 1) {
        const liveStatus = TimerService.calculateLiveStatus(order, TimerService.getEffectiveHourlyPrice(order));
        
        order.dataValues.rate_per_minute = liveStatus.charge;
        order.dataValues.is_timer_clock = liveStatus.clockStr;
        
        // Also update total in response
        const itemsTotal = (order.orders_items || []).reduce((sum, it) => sum + (parseFloat(it.count) * parseFloat(it.price)), 0);
        const newTotal = itemsTotal + liveStatus.charge;
        
        // Handle discounts/service fees if needed
        let discount = parseFloat(order.discount || 0);
        let service = parseFloat(order.service_charge || 0);
        
        if (parseFloat(order.discount_value) > 0) {
          discount = order.discount_type === "percent" ? (newTotal * parseFloat(order.discount_value)) / 100 : parseFloat(order.discount_value);
        }
        if (parseFloat(order.service_value) > 0) {
          service = order.service_type === "percent" ? (newTotal * parseFloat(order.service_value)) / 100 : parseFloat(order.service_value);
        }
        
        order.dataValues.amount = newTotal;
        order.dataValues.total = Math.max(0, newTotal - discount + service);
        order.dataValues.discount = discount;
        order.dataValues.service_charge = service;
      }
    }

    res.status(200).json({ message: "success", data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", data: {} });
  }
};

module.exports = { getAllActiveOrders, getArchivedOrders, getOrderById };


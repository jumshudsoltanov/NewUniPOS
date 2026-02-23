const OrderLogsModel = require("../model/OrderLogsModel");
const SyncService = require("../services/SyncService");

const addLog = async (req, res) => {
    const { orderId } = req.params;
    const { action, waiterName, details, time } = req.body;

    if (!orderId || !action) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const OrdersModel = require("../model/OrdersModel");
        await OrdersModel.update({ is_synced: 0 }, { where: { uuid: orderId } });

        const newLog = await OrderLogsModel.create({
            order_id: orderId,
            action,
            waiter_name: waiterName,
            details,
            time: time || new Date().toISOString(),
        });

        // Trigger sync for this order to include the new log
        SyncService.triggerSync(orderId);

        return res.status(201).json(newLog);
    } catch (error) {
        console.error("Error adding log:", error);
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};

const getLogs = async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
        return res.status(400).json({ message: "Missing order ID" });
    }

    try {
        const logs = await OrderLogsModel.findAll({
            where: { order_id: orderId },
            order: [["created_at", "DESC"]], // Show newest first
        });

        return res.status(200).json(logs);
    } catch (error) {
        console.error("Error fetching logs:", error);
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};

module.exports = {
    addLog,
    getLogs,
};

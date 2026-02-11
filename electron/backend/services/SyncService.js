const axios = require("axios");
const { Op } = require("sequelize");
const OrdersModel = require("../model/OrdersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const OrderLogsModel = require("../model/OrderLogsModel");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");

const ADMIN_API_URL = "https://api.unipos.tech/api/sync";

class SyncService {
  constructor() {
    this.isSyncing = false;
    setInterval(() => this.syncPendingOrders(), 60000);
  }

  async triggerSync(orderId) {
    try {
      // Fetch comprehensive order data
      const order = await OrdersModel.findOne({ where: { uuid: orderId } });
      if (!order) return;

      const items = await OrdersItemsModel.findAll({
        where: { order_id: orderId },
      });

      // Attach product names to items
      const ProductsModel = require("../model/ProductsModel");
      for (let item of items) {
        const product = await ProductsModel.findOne({
          where: { id: item.product_id },
        });
        if (product) {
          item.setDataValue("product_name", product.name);
        }
      }

      const logs = await OrderLogsModel.findAll({
        where: { order_id: orderId },
      });
      const payments = await OrderPaymentsModel.findAll({
        where: { order_id: orderId },
      });

      // Fetch related table if exists (to ensure it's synced to admin)
      let table = null;
      if (order.table_id) {
        const TablesModel = require("../model/TablesModel");
        table = await TablesModel.findOne({ where: { id: order.table_id } });
      }

      // Fetch waiter name
      if (order.waiter_id) {
        const WaitersModel = require("../model/WaitersModel");
        const waiter = await WaitersModel.findOne({
          where: { id: order.waiter_id },
        });
        if (waiter) {
          order.setDataValue("waiter_name", waiter.name);
        }
      }

      const payload = {
        orders: [order],
        items: items,
        logs: logs,
        payments: payments,
        tables: table ? [table] : [], // Include table data
      };

      await this.sendToAdmin(payload);

      // If successful, mark as synced
      await OrdersModel.update({ is_synced: 1 }, { where: { uuid: orderId } });
      console.log(`Order ${orderId} synced successfully`);
    } catch (error) {
      console.error(`Failed to sync order ${orderId}:`, error.message);
      // Mark as unsynced so background job picks it up
      await OrdersModel.update({ is_synced: 0 }, { where: { uuid: orderId } });
    }
  }

  async syncPendingOrders() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pendingOrders = await OrdersModel.findAll({
        where: {
          [Op.or]: [{ is_synced: 0 }, { is_synced: null }],
        },
        limit: 50, // process in chunks
      });

      if (pendingOrders.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`Found ${pendingOrders.length} pending orders to sync...`);

      for (const order of pendingOrders) {
        await this.triggerSync(order.uuid);
      }
    } catch (error) {
      console.error("Error in background sync:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  async sendToAdmin(payload) {
    try {
      const response = await axios.post(ADMIN_API_URL, payload, {
        timeout: 5000, // 5 second timeout
      });

      if (response.status === 200 && response.data.success) {
        return true;
      } else {
        throw new Error("Admin API returned failure");
      }
    } catch (error) {
      throw error; // Re-throw to be caught by caller
    }
  }
}

module.exports = new SyncService();

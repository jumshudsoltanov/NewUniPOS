const axios = require("axios");
const { Op } = require("sequelize");
const OrdersModel = require("../model/OrdersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const OrderLogsModel = require("../model/OrderLogsModel");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");
const ProductsModel = require("../model/ProductsModel");
const TablesModel = require("../model/TablesModel");
const WaitersModel = require("../model/WaitersModel");
const TablesGroupsModel = require("../model/TableGroupsModel");

const ADMIN_API_URL = "https://api.unipos.tech/api/sync";
const ADMIN_API_FALLBACK_URL = "http://46.224.8.157:35627/api/sync";

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = new Date(); // Initialize with current time on startup
    setInterval(() => this.syncPendingOrders(), 30000);
  }

  async getSyncStatus() {
    try {
      const OrderPaymentsModel = require("../model/OrderPaymentsModel");
      const OrderLogsModel = require("../model/OrderLogsModel");

      const [pendingOrders, syncedCount] = await Promise.all([
        OrdersModel.findAll({
          where: {
            [Op.or]: [{ is_synced: 0 }, { is_synced: null }],
          },
          include: [
            { model: OrdersItemsModel, as: 'orders_items' },
            { model: OrderPaymentsModel, as: 'order_payments' },
            { model: OrderLogsModel, as: 'order_logs' }
          ]
        }).catch(err => {
          console.warn("SyncStatus: Falling back to simple count due to inclusion error:", err.message);
          return OrdersModel.findAll({ where: { [Op.or]: [{ is_synced: 0 }, { is_synced: null }] } });
        }),
        OrdersModel.count({
          where: { is_synced: 1 },
        }),
      ]);

      // Sum orders + items + payments + logs for a very granular count
      let pendingCount = pendingOrders.length;
      pendingOrders.forEach(order => {
        if (order.orders_items) pendingCount += order.orders_items.length;
        if (order.order_payments) pendingCount += order.order_payments.length;
        if (order.order_logs) pendingCount += order.order_logs.length;
      });

      return {
        isSyncing: this.isSyncing,
        pendingCount: pendingCount,
        syncedCount: syncedCount,
        lastSyncTime: this.lastSyncTime
      };
    } catch (error) {
      //...
      console.error("Error getting sync status:", error);
      return {
        isSyncing: this.isSyncing,
        pendingCount: 0,
        syncedCount: 0,
        lastSyncTime: this.lastSyncTime
      };
    }
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
        table = await TablesModel.findOne({ where: { id: order.table_id } });
      }

      // Fetch waiter name
      if (order.waiter_id) {
        const waiter = await WaitersModel.findOne({
          where: { id: order.waiter_id },
        });
        if (waiter) {
          order.setDataValue("waiter_name", waiter.name);
        }
      }

      const payload = {
        profile_id: order.profile_id, // Root level profile_id for cloud routing
        orders: [{
          ...order.get({ plain: true }),
          waiter_name: order.getDataValue("waiter_name") || order.waiter_name
        }],
        items: items.map(item => ({
          ...item.get({ plain: true }),
          product_name: item.getDataValue("product_name") || item.product_name
        })),
        logs: logs.map(log => log.get({ plain: true })),
        payments: payments.map(payment => payment.get({ plain: true })),
        tables: table ? [table.get({ plain: true })] : [],
      };

      console.log(`[SYNC] Sending payload for Order ${orderId}: Items=${payload.items.length}, Logs=${payload.logs.length}, Payments=${payload.payments.length}`);

      await this.sendToAdmin(payload);

      // If successful, mark as synced
      await OrdersModel.update({ is_synced: 1 }, { where: { uuid: orderId } });
      this.lastSyncTime = new Date();
      console.log(`Order ${orderId} synced successfully`);
    } catch (error) {
      console.error(`Failed to sync order ${orderId}:`, error.message);
      // Mark as unsynced so background job picks it up
      await OrdersModel.update({ is_synced: 0 }, { where: { uuid: orderId } });
    }
  }

  async syncPendingOrders() {
    // Only the Master node should perform background synchronization.
    // Slave nodes rely on the Master to handle all database operations and cloud syncing.
    if (!global.isMasterNode) {
      return;
    }

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
      this.lastSyncTime = new Date();
    } catch (error) {
      console.error("Error in background sync:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  async sendToAdmin(payload) {
    let lastError = null;
    const urls = [ADMIN_API_URL, ADMIN_API_FALLBACK_URL];

    for (const url of urls) {
      try {
        console.log(`[SYNC] Attempting sync to ${url}...`);
        const response = await axios.post(url, payload, {
          timeout: 10000,
        });

        console.log(`[SYNC] Response from ${url}: Status=${response.status}`);
        if (response.status >= 200 && response.status < 300) {
          return true;
        }
      } catch (error) {
        console.warn(`[SYNC] Primary sync failed for ${url}:`, error.message);
        lastError = error;
      }
    }
    throw lastError || new Error("All sync endpoints failed");
  }
}

module.exports = new SyncService();

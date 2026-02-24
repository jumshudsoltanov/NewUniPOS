const axios = require("axios");
const { Op } = require("sequelize");
const OrdersModel = require("../model/OrdersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const OrderLogsModel = require("../model/OrderLogsModel");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");
const ProductsModel = require("../model/ProductsModel");
const TablesModel = require("../model/TablesModel");
const WaitersModel = require("../model/WaitersModel");
const LoginModel = require("../model/LoginModel");

const ADMIN_API_URL = "https://api.unipos.tech/api/sync";
const ADMIN_API_FALLBACK_URL = "http://46.224.8.157:35627/api/sync";

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = new Date();
    console.log("[SYNC_INIT] SyncService instance created.");

    // Start interval
    setInterval(() => {
      if (global.isMasterNode && !this.isSyncing) {
        this.syncPendingOrders().catch(err => console.error("[SYNC_INTERVAL_ERR]", err));
      }
    }, 15000); // 15 seconds
  }

  async getSyncStatus() {
    try {
      const [totalSyncedCount, pendingCount] = await Promise.all([
        OrdersModel.count({ where: { is_synced: 1 } }),
        OrdersModel.count({
          where: {
            [Op.or]: [{ is_synced: 0 }, { is_synced: null }],
            amount: { [Op.gt]: 0 }
          },
        }),
      ]);

      return {
        isSyncing: this.isSyncing,
        pendingCount: pendingCount,
        syncedCount: totalSyncedCount,
        lastSyncTime: this.lastSyncTime
      };
    } catch (error) {
      return { isSyncing: this.isSyncing, pendingCount: 0, syncedCount: 0 };
    }
  }

  async triggerSync(orderId) {
    try {
      const order = await OrdersModel.findOne({ where: { uuid: orderId } });
      if (!order) return;

      // Ensure profile_id exists (critical for routing)
      let profileId = order.profile_id;
      if (!profileId) {
        const profile = await LoginModel.findOne();
        profileId = profile?.id;
        if (profileId) {
          await OrdersModel.update({ profile_id: profileId }, { where: { uuid: orderId } });
          console.log(`[SYNC] Recovered profile_id ${profileId} for order ${orderId}`);
        } else {
          throw new Error("Missing profile_id and could not recover from LoginModel");
        }
      }

      const items = await OrdersItemsModel.findAll({ where: { order_id: orderId } });
      const logs = await OrderLogsModel.findAll({ where: { order_id: orderId } });
      const payments = await OrderPaymentsModel.findAll({ where: { order_id: orderId } });
      let table = order.table_id ? await TablesModel.findOne({ where: { id: order.table_id } }) : null;

      const payload = {
        profile_id: profileId,
        orders: [order.get({ plain: true })],
        items: items.map(item => item.get({ plain: true })),
        logs: logs.map(log => log.get({ plain: true })),
        payments: payments.map(payment => payment.get({ plain: true })),
        tables: table ? [table.get({ plain: true })] : [],
      };

      await this.sendToAdmin(payload);
      await OrdersModel.update({ is_synced: 1 }, { where: { uuid: orderId } });
      this.lastSyncTime = new Date();
      console.log(`[SYNC] Success: ${orderId}`);
    } catch (error) {
      console.error(`[SYNC_FAIL] ${orderId}: ${error.message}`);
      throw error;
    }
  }

  async syncPendingOrders() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const isOnline = await this.checkConnectivity();
      if (!isOnline) {
        this.isSyncing = false;
        return;
      }

      const pendingOrders = await OrdersModel.findAll({
        where: { [Op.or]: [{ is_synced: 0 }, { is_synced: null }], amount: { [Op.gt]: 0 } },
        limit: 10, // Small batches
      });

      if (pendingOrders.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[SYNC_LOOP] Found ${pendingOrders.length} orders. Processing...`);
      for (const order of pendingOrders) {
        try {
          await this.triggerSync(order.uuid);
        } catch (e) {
          // Individual failure shouldn't stop the loop
        }
      }
      console.log("[SYNC_LOOP] Cycle complete.");
    } catch (error) {
      console.error("[SYNC_LOOP_CRITICAL]", error);
    } finally {
      this.isSyncing = false;
    }
  }

  async checkConnectivity() {
    const endpoints = [
      "http://46.224.8.157:35627/api/discover", // Using Admin IP directly
      "https://www.google.com",
      "https://1.1.1.1"
    ];
    for (const url of endpoints) {
      try {
        await axios.get(url, { timeout: 5000 });
        console.log(`[SYNC_CONN] Online via ${url}`);
        return true;
      } catch (e) {
        // If we get a response (even 404/403), it means we have internet
        if (e.response) {
          console.log(`[SYNC_CONN] Online (Response received from ${url})`);
          return true;
        }
        console.warn(`[SYNC_CONN] Failed to reach ${url}: ${e.message}`);
      }
    }
    console.error("[SYNC_CONN] All checks failed. System is OFFLINE.");
    return false;
  }

  async sendToAdmin(payload) {
    const urls = [ADMIN_API_URL, ADMIN_API_FALLBACK_URL];
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await axios.post(url, payload, { timeout: 5000 });
        if (response.status >= 200 && response.status < 300) return true;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("All endpoints failed");
  }
}

module.exports = new SyncService();

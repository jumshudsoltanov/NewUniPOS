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
    this._pendingQueue = new Set(); // UUIDs waiting to be synced
    this._processingQueue = false;
    console.log("[SYNC_INIT] SyncService instance created.");

    // Start interval — retry every 15s, also handles reconnect after internet drop
    setInterval(() => {
      if (global.isMasterNode && !this.isSyncing) {
        this.syncPendingOrders().catch(err => console.error("[SYNC_INTERVAL_ERR]", err));
      }
    }, 15000);

    // Extra reconnect check: if offline, poll every 5s until back online, then trigger sync
    this._offlinePoller = null;
    this._wasOffline = false;
    setInterval(async () => {
      if (!global.isMasterNode) return;
      const online = await this.checkConnectivity().catch(() => false);
      if (!online) {
        this._wasOffline = true;
      } else if (this._wasOffline) {
        this._wasOffline = false;
        console.log("[SYNC_RECONNECT] Internet restored — triggering sync...");
        if (!this.isSyncing) {
          this.syncPendingOrders().catch(err => console.error("[SYNC_RECONNECT_ERR]", err));
        }
      }
    }, 5000);
  }

  async getSyncStatus() {
    try {
      const currentProfileId = await this.getCurrentProfileId();
      const profileFilter = currentProfileId ? { profile_id: currentProfileId } : {};

      const [totalSyncedCount, pendingCount] = await Promise.all([
        OrdersModel.count({ where: { ...profileFilter, is_synced: 1 } }),
        OrdersModel.count({
          where: {
            ...profileFilter,
            [Op.or]: [{ is_synced: 0 }, { is_synced: null }]
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

  // Called from controllers — adds to queue and processes serially
  queueSync(orderId) {
    if (!orderId) return;
    this._pendingQueue.add(orderId);
    if (!this._processingQueue) {
      this._drainQueue().catch(err => console.error("[SYNC_QUEUE_ERR]", err));
    }
  }

  async _drainQueue() {
    if (this._processingQueue) return;
    this._processingQueue = true;
    try {
      while (this._pendingQueue.size > 0) {
        const orderId = this._pendingQueue.values().next().value;
        this._pendingQueue.delete(orderId);
        try {
          await this.triggerSync(orderId);
        } catch (e) {
          // already logged inside triggerSync
        }
      }
    } finally {
      this._processingQueue = false;
    }
  }

  async triggerSync(orderId) {
    try {
      const order = await OrdersModel.findOne({
        where: { uuid: orderId },
        paranoid: false,
        attributes: { include: ["deleted_at"] }
      });
      if (!order) return;

      // Ensure profile_id exists (critical for routing)
      let profileId = order.profile_id;
      if (!profileId) {
        const profile = await LoginModel.findOne({ order: [['updated_at', 'DESC']] });
        profileId = profile?.id;
        if (profileId) {
          await OrdersModel.update({ profile_id: profileId }, { where: { uuid: orderId } }, { paranoid: false });
          console.log(`[SYNC] Recovered profile_id ${profileId} for order ${orderId}`);
        } else {
          throw new Error("Missing profile_id and could not recover from LoginModel");
        }
      }

      const items = await OrdersItemsModel.findAll({ 
        where: { order_id: order.uuid },
        paranoid: false,
        attributes: { include: ["deleted_at"] }
      });
      const logs = await OrderLogsModel.findAll({ 
        where: { order_id: order.uuid },
        paranoid: false,
        attributes: { include: ["deleted_at"] }
      });
      const payments = await OrderPaymentsModel.findAll({ 
        where: { order_id: order.uuid },
        paranoid: false,
        attributes: { include: ["deleted_at"] }
      });
      let table = order.table_id ? await TablesModel.findOne({ where: { id: order.table_id } }) : null;

      const payload = {
        profile_id: profileId,
        orders: [(() => {
          const plain = order.get({ plain: true });
          if (plain.deleted_at) {
            plain.status = 3; // Deleted status for Admin
            plain.amount = 0;
            plain.total = 0;
          }
          return plain;
        })()],
        items: items.map(item => {
          const plain = item.get({ plain: true });
          if (plain.deleted_at) {
            plain.count = 0;
          }
          return plain;
        }),
        logs: logs.map(log => log.get({ plain: true })),
        payments: payments.map(payment => {
          const plain = payment.get({ plain: true });
          if (plain.deleted_at) {
            plain.paid = 0;
          }
          return plain;
        }),
        tables: table ? [table.get({ plain: true })] : [],
      };

      await this.sendToAdmin(payload);
      await OrdersModel.update({ is_synced: 1 }, { where: { uuid: orderId } });
      this.lastSyncTime = new Date();
      console.log(`[SYNC] Success: ${orderId}`);
    } catch (error) {
      console.error(`[SYNC_FAIL] ${orderId}: ${error.message}`);
      // Head-of-Line Blocking Fix: If validation failed, skip order.
      if (error.isValidationError) {
        console.warn(`[SYNC_SKIP] Skipping order ${orderId} due to validation error.`);
        await OrdersModel.update({ is_synced: 2 }, { where: { uuid: orderId } });
      }
      throw error;
    }
  }

  async getCurrentProfileId() {
    const profile = await LoginModel.findOne({ order: [['updated_at', 'DESC']] });
    return profile?.id || null;
  }

  async syncPendingOrders() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const isOnline = await this.checkConnectivity();
      if (!isOnline) {
        return;
      }

      // Only sync orders belonging to the currently active profile
      const currentProfileId = await this.getCurrentProfileId();
      if (!currentProfileId) {
        console.warn("[SYNC_LOOP] No active profile found, skipping sync.");
        return;
      }

      const pendingOrders = await OrdersModel.findAll({
        where: {
          profile_id: currentProfileId,
          // is_synced: 2 = validation error (skip forever), only retry 0 and null
          [Op.and]: [
            { [Op.or]: [{ is_synced: 0 }, { is_synced: null }] },
            { [Op.not]: { status: 3, amount: 0 } }
          ]
        },
        limit: 10,
      });

      if (pendingOrders.length === 0) {
        return;
      }

      console.log(`[SYNC_LOOP] Profile ${currentProfileId}: Found ${pendingOrders.length} orders. Processing...`);
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
      "http://46.224.8.157:35627/api/discover",
      "https://www.google.com",
      "https://1.1.1.1"
    ];

    try {
      await Promise.any(
        endpoints.map((url) =>
          axios.get(url, { timeout: 3000 }).then((res) => {
             console.log(`[SYNC_CONN] Online via ${url}`);
             return true;
          }).catch((e) => {
             if (e.response) {
               console.log(`[SYNC_CONN] Online (Response received from ${url})`);
               return true;
             }
             throw e;
          })
        )
      );
      return true;
    } catch (aggregateError) {
      console.error("[SYNC_CONN] All checks failed. System is OFFLINE.");
      return false;
    }
  }

  async sendToAdmin(payload) {
    const urls = [ADMIN_API_URL, ADMIN_API_FALLBACK_URL];
    let lastError = null;

    for (const url of urls) {
      try {
        const response = await axios.post(url, payload, { timeout: 8000 });
        if (response.status >= 200 && response.status < 300) return true;
      } catch (error) {
        lastError = error;

        // If Admin API explicitly rejects with 4xx validation error, fail fast and don't retry other urls
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
           const validationErr = new Error(`Admin API Validation Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
           validationErr.isValidationError = true;
           validationErr.originalError = error;
           throw validationErr;
        }
        console.warn(`[SYNC_URL_FAIL] ${url}: ${error.message}`);
      }
    }
    throw lastError || new Error("All endpoints failed");
  }
}

module.exports = new SyncService();

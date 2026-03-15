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
    this._pendingQueue = new Set();   // UUIDs waiting to be synced
    this._processingQueue = false;
    this._currentlySyncing = new Set(); // Track in-progress syncs to prevent duplicates
    this._wasOffline = false;
    console.log("[SYNC_INIT] SyncService instance created.");

    // Retry interval — every 5s (was 15s)
    setInterval(() => {
      if (global.isMasterNode && !this.isSyncing) {
        this.syncPendingOrders().catch(err => console.error("[SYNC_INTERVAL_ERR]", err));
      }
    }, 5000);

    // Reconnect poller: when internet comes back, immediately trigger sync
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
            [Op.or]: [{ is_synced: 0 }, { is_synced: null }],
          },
          paranoid: false,
        }),
      ]);

      return {
        isSyncing: this.isSyncing,
        pendingCount,
        syncedCount: totalSyncedCount,
        lastSyncTime: this.lastSyncTime,
      };
    } catch (error) {
      return { isSyncing: this.isSyncing, pendingCount: 0, syncedCount: 0 };
    }
  }

  // Called from controllers — marks order as pending in DB first (critical!), then queues
  queueSync(orderId) {
    if (!orderId) return;

    // Mark as unsynced in DB immediately so the retry interval can catch it if queue fails
    OrdersModel.update(
      { is_synced: 0 },
      { where: { uuid: orderId }, paranoid: false }
    ).catch(err => console.error("[SYNC_MARK_ERR]", err));

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

        // Skip if already being synced (e.g., by interval)
        if (this._currentlySyncing.has(orderId)) continue;

        try {
          this._currentlySyncing.add(orderId);
          await this.triggerSync(orderId);
        } catch (e) {
          // Order stays is_synced=0 in DB, interval will retry
        } finally {
          this._currentlySyncing.delete(orderId);
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
        attributes: { include: ["deleted_at"] },
      });
      if (!order) return;

      // Ensure profile_id exists (critical for routing)
      let profileId = order.profile_id;
      if (!profileId) {
        const profile = await LoginModel.findOne({ order: [["updated_at", "DESC"]] });
        profileId = profile?.id;
        if (profileId) {
          await OrdersModel.update({ profile_id: profileId }, { where: { uuid: orderId }, paranoid: false });
          console.log(`[SYNC] Recovered profile_id ${profileId} for order ${orderId}`);
        } else {
          throw new Error("Missing profile_id and could not recover from LoginModel");
        }
      }

      const [items, logs, payments] = await Promise.all([
        OrdersItemsModel.findAll({
          where: { order_id: order.uuid },
          paranoid: false,
          attributes: { include: ["deleted_at"] },
        }),
        OrderLogsModel.findAll({
          where: { order_id: order.uuid },
          paranoid: false,
          attributes: { include: ["deleted_at"] },
        }),
        OrderPaymentsModel.findAll({
          where: { order_id: order.uuid },
          paranoid: false,
          attributes: { include: ["deleted_at"] },
        }),
      ]);

      const table = order.table_id
        ? await TablesModel.findOne({ where: { id: order.table_id } })
        : null;

      const payload = {
        profile_id: profileId,
        orders: [(() => {
          const plain = order.get({ plain: true });
          if (plain.deleted_at) {
            plain.status = 3;
            plain.amount = 0;
            plain.total = 0;
          }
          return plain;
        })()],
        items: items.map(item => {
          const plain = item.get({ plain: true });
          if (plain.deleted_at) plain.count = 0;
          plain.order_id = order.uuid;
          plain.profile_id = plain.profile_id || profileId;
          delete plain.kds_status;
          delete plain.modifiers;
          delete plain.comment;
          delete plain.is_delete_reason_id;
          return plain;
        }),
        logs: logs.map(log => {
          const plain = log.get({ plain: true });
          plain.order_id = order.uuid;
          return plain;
        }),
        payments: payments.map(payment => {
          const plain = payment.get({ plain: true });
          if (plain.deleted_at) plain.paid = 0;
          plain.order_id = order.uuid;
          plain.profile_id = plain.profile_id || profileId;
          return plain;
        }),
        tables: table ? [table.get({ plain: true })] : [],
      };

      await this.sendToAdmin(payload);
      await OrdersModel.update({ is_synced: 1 }, { where: { uuid: orderId }, paranoid: false });
      this.lastSyncTime = new Date();
      console.log(`[SYNC] Success: ${orderId}`);
    } catch (error) {
      console.error(`[SYNC_FAIL] ${orderId}: ${error.message}`);
      if (error.isValidationError) {
        console.warn(`[SYNC_SKIP] Skipping order ${orderId} due to validation error.`);
        await OrdersModel.update({ is_synced: 2 }, { where: { uuid: orderId }, paranoid: false });
      }
      // For non-validation errors: order stays is_synced=0, retry interval will pick it up
      throw error;
    }
  }

  async getCurrentProfileId() {
    const profile = await LoginModel.findOne({ order: [["updated_at", "DESC"]] });
    return profile?.id || null;
  }

  async syncPendingOrders() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const isOnline = await this.checkConnectivity();
      if (!isOnline) return;

      const pendingOrders = await OrdersModel.findAll({
        where: {
          [Op.or]: [{ is_synced: 0 }, { is_synced: null }],
        },
        paranoid: false,
        limit: 50, // was 10
        order: [["updated_at", "ASC"]], // oldest first
      });

      if (pendingOrders.length === 0) return;

      console.log(`[SYNC_LOOP] Found ${pendingOrders.length} pending orders. Processing...`);

      for (const order of pendingOrders) {
        // Skip if already being synced by the queue drain
        if (this._currentlySyncing.has(order.uuid)) continue;

        try {
          this._currentlySyncing.add(order.uuid);
          await this.triggerSync(order.uuid);
        } catch (e) {
          // Individual failure doesn't stop the loop; order stays is_synced=0 for next cycle
        } finally {
          this._currentlySyncing.delete(order.uuid);
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
      "https://1.1.1.1",
    ];

    try {
      await Promise.any(
        endpoints.map(url =>
          axios.get(url, { timeout: 3000 }).then(() => true).catch(e => {
            if (e.response) return true; // got a response = online
            throw e;
          })
        )
      );
      return true;
    } catch {
      console.error("[SYNC_CONN] All checks failed. System is OFFLINE.");
      return false;
    }
  }

  async sendToAdmin(payload) {
    const urls = [ADMIN_API_URL, ADMIN_API_FALLBACK_URL];
    let lastError = null;

    // Try both URLs in parallel, use whichever responds first
    try {
      await Promise.any(
        urls.map(url =>
          axios.post(url, payload, { timeout: 6000 }).then(res => {
            if (res.status >= 200 && res.status < 300) return true;
            throw new Error(`Unexpected status ${res.status}`);
          }).catch(error => {
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
              // Validation error — wrap and re-throw immediately
              const validationErr = new Error(
                `Admin API Validation Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
              );
              validationErr.isValidationError = true;
              validationErr.originalError = error;
              throw validationErr;
            }
            lastError = error;
            console.warn(`[SYNC_URL_FAIL] ${url}: ${error.message}`);
            throw error;
          })
        )
      );
      return true;
    } catch (aggregateError) {
      // Check if any of the errors was a validation error
      const errors = aggregateError.errors || [];
      const validationErr = errors.find(e => e.isValidationError);
      if (validationErr) throw validationErr;
      throw lastError || new Error("All sync endpoints failed");
    }
  }
}

module.exports = new SyncService();

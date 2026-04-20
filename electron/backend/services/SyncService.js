const axios = require("axios");
const http = require("http");
const https = require("https");
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

// Fresh connection for each sync request — avoids stale/dead socket reuse
// minVersion TLSv1 required: server uses older TLS, Node.js v24+ defaults to TLS 1.2 minimum
const syncAxios = axios.create({
  httpAgent: new http.Agent({ keepAlive: false }),
  httpsAgent: new https.Agent({
    keepAlive: false,
    rejectUnauthorized: false,
    minVersion: "TLSv1",
  }),
});

/** Bir sifariş üçün maks. gözləmə — donmuş HTTP/socket üçün */
const SYNC_ORDER_TIMEOUT_MS = 35000;
/** Hər dövrdə maks. sifariş sayı — uzun bloklamanın qarşısını alır */
const SYNC_BATCH_LIMIT = 15;
/** finally çağrılmırsa (nadir) — dövrün maks. müddətindən böyük olmalıdır */
const SYNC_WATCHDOG_MS = SYNC_BATCH_LIMIT * SYNC_ORDER_TIMEOUT_MS + 30000;

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = new Date();
    this._syncCycleStartedAt = 0;
    this._pendingQueue = new Set(); // UUIDs waiting to be synced
    this._processingQueue = false;
    this._currentlySyncing = new Set(); // Track in-progress syncs to prevent duplicates
    this._retryCounts = new Map(); // orderId → failure count
    this._wasOffline = false;
    this.lastSyncError = null;
    this.lastSyncErrorAt = null;
    this.lastSyncErrorOrderPrefix = null;
    console.log("[SYNC_INIT] SyncService instance created.");

    // Retry interval — hər 2s (ən son vəziyyət tez göndərilsin)
    setInterval(() => {
      if (this._canSync() && !this.isSyncing) {
        this.syncPendingOrders().catch((err) =>
          console.error("[SYNC_INTERVAL_ERR]", err),
        );
      }
    }, 2000);

    // Reconnect poller: when internet comes back, immediately trigger sync
    setInterval(async () => {
      if (!this._canSync()) return;
      const online = await this.checkConnectivity().catch(() => false);
      if (!online) {
        this._wasOffline = true;
      } else if (this._wasOffline) {
        this._wasOffline = false;
        // Reset retry counts so all pending orders get fresh attempts after reconnect
        this._retryCounts.clear();
        // Clear stale error from offline period — internet is back
        this.clearLastSyncError();
        console.log("[SYNC_RECONNECT] Internet restored — triggering sync...");
        if (!this.isSyncing) {
          this.syncPendingOrders().catch((err) =>
            console.error("[SYNC_RECONNECT_ERR]", err),
          );
        }
      }
    }, 5000);

    // Hər 5 dəqiqə: skip olunmuş (is_synced=2) sifarişləri sıfırla və yenidən göndər — ən son halda qalmaq üçün
    setInterval(
      async () => {
        if (!this._canSync()) return;
        try {
          const { Op } = require("sequelize");
          const [count] = await OrdersModel.update(
            { is_synced: 0 },
            { where: { is_synced: 2 }, paranoid: false },
          );
          if (count > 0) {
            this._retryCounts.clear();
            console.log(
              `[SYNC_RETRY_SKIPPED] Reset ${count} skipped orders for retry.`,
            );
            if (!this.isSyncing) {
              this.syncPendingOrders().catch((err) =>
                console.error("[SYNC_RETRY_SKIPPED_ERR]", err),
              );
            }
          }
        } catch (err) {
          console.error("[SYNC_RETRY_SKIPPED_ERR]", err);
        }
      },
      5 * 60 * 1000,
    ); // 5 dəqiqə

    // Watchdog: avto sync donanda isSyncing və ya şəbəkə səbəbindən dövr bitməyəndə sıfırla
    setInterval(() => {
      if (!this._canSync()) return;
      if (!this.isSyncing || !this._syncCycleStartedAt) return;
      if (Date.now() - this._syncCycleStartedAt < SYNC_WATCHDOG_MS) return;
      console.error(
        "[SYNC_WATCHDOG] Dövr çox uzun sürdü — isSyncing sıfırlanır, növbəti interval işləyəcək",
      );
      this.isSyncing = false;
      this._syncCycleStartedAt = 0;
      this._currentlySyncing.clear();
    }, 8000);
  }

  /**
   * Sync həmişə işləməlidir — master olub-olmamasından asılı olmayaraq.
   * Tək Terminal rejimində isMasterNode bəzən false qalır (login timing).
   * Sync-in işləməsi üçün yalnız DB-də profile olması kifayətdir.
   */
  _canSync() {
    return true;
  }

  _withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} (${ms}ms)`)), ms),
      ),
    ]);
  }

  recordSyncFailure(orderId, error) {
    const raw = error?.message || String(error);
    this.lastSyncError = raw.length > 480 ? `${raw.slice(0, 480)}…` : raw;
    this.lastSyncErrorAt = new Date().toISOString();
    if (orderId && typeof orderId === "string") {
      this.lastSyncErrorOrderPrefix =
        orderId.length >= 8 ? orderId.slice(0, 8) : orderId;
    } else {
      this.lastSyncErrorOrderPrefix = null;
    }
  }

  clearLastSyncError() {
    this.lastSyncError = null;
    this.lastSyncErrorAt = null;
    this.lastSyncErrorOrderPrefix = null;
  }

  async getSyncStatus() {
    try {
      const currentProfileId = await this.getCurrentProfileId();
      const profileFilter = currentProfileId
        ? { profile_id: currentProfileId }
        : {};

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
        lastSyncError: this.lastSyncError,
        lastSyncErrorAt: this.lastSyncErrorAt,
        lastSyncErrorOrderPrefix: this.lastSyncErrorOrderPrefix,
      };
    } catch (error) {
      return {
        isSyncing: this.isSyncing,
        pendingCount: 0,
        syncedCount: 0,
        lastSyncError: this.lastSyncError,
        lastSyncErrorAt: this.lastSyncErrorAt,
        lastSyncErrorOrderPrefix: this.lastSyncErrorOrderPrefix,
      };
    }
  }

  // Called from controllers — marks order as pending in DB first (critical!), then queues
  queueSync(orderId) {
    if (!orderId) return;

    // Mark as unsynced in DB immediately so the retry interval can catch it if queue fails
    OrdersModel.update(
      { is_synced: 0 },
      { where: { uuid: orderId }, paranoid: false },
    ).catch((err) => console.error("[SYNC_MARK_ERR]", err));

    this._pendingQueue.add(orderId);
    if (!this._processingQueue) {
      this._drainQueue().catch((err) => console.error("[SYNC_QUEUE_ERR]", err));
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
        const profile = await LoginModel.findOne({
          order: [["updated_at", "DESC"]],
        });
        profileId = profile?.id;
        if (profileId) {
          await OrdersModel.update(
            { profile_id: profileId },
            { where: { uuid: orderId }, paranoid: false },
          );
          console.log(
            `[SYNC] Recovered profile_id ${profileId} for order ${orderId}`,
          );
        } else {
          throw new Error(
            "Missing profile_id and could not recover from LoginModel",
          );
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

      const isDeleted = !!(
        order.deletedAt ||
        order.deleted_at ||
        order.get?.("deletedAt") ||
        order.get?.("deleted_at")
      );

      const table = order.table_id
        ? await TablesModel.findOne({ where: { id: order.table_id } })
        : null;
      const TableGroupsModel = require("../model/TableGroupsModel");
      const tableGroup = table?.hall_id
        ? await TableGroupsModel.findOne({ where: { id: table.hall_id } })
        : null;

      const payload = {
        profile_id: profileId,
        orders: [
          (() => {
            const plain = order.get({ plain: true });
            if (plain.deleted_at) {
              plain.status = 3;
              plain.amount = 0;
              plain.total = 0;
            }
            return plain;
          })(),
        ],
        items: items
          .filter((item) => item.get({ plain: true }).deleted_at === null)
          .map((item) => {
            const plain = item.get({ plain: true });
            plain.order_id = order.uuid;
            plain.profile_id = plain.profile_id || profileId;
            delete plain.kds_status;
            delete plain.comment;
            delete plain.is_delete_reason_id;
            return plain;
          }),
        deleted_items: items
          .filter((item) => item.get({ plain: true }).deleted_at !== null)
          .map((item) => {
            const plain = item.get({ plain: true });
            plain.order_id = order.uuid;
            plain.profile_id = plain.profile_id || profileId;
            delete plain.kds_status;
            delete plain.comment;
            delete plain.is_delete_reason_id;
            return plain;
          }),
        logs: logs.map((log) => {
          const plain = log.get({ plain: true });
          plain.order_id = order.uuid;
          return plain;
        }),
        payments: payments.map((payment) => {
          const plain = payment.get({ plain: true });
          if (plain.deleted_at) plain.paid = 0;
          plain.order_id = order.uuid;
          plain.profile_id = plain.profile_id || profileId;
          return plain;
        }),
        table_groups: tableGroup ? [tableGroup.get({ plain: true })] : [],
        tables: table ? [table.get({ plain: true })] : [],
      };

      try {
        await this.sendToAdmin(payload);
      } catch (firstErr) {
        // 409 = admin-da artıq var. Bir də force_overwrite ilə cəhd et — ən son halda qalmaq üçün
        if (firstErr.isAlreadySynced) {
          console.log(
            `[SYNC_409] Order ${orderId} admin-da var. Force overwrite ilə yenidən cəhd...`,
          );
          try {
            await this.sendToAdmin({ ...payload, force_overwrite: true });
          } catch (retryErr) {
            if (retryErr.isAlreadySynced) {
              const isOrderOpen = Number(order.status) === 1 && !isDeleted;
              if (isOrderOpen) {
                console.log(
                  `[SYNC_409_OK] Order ${orderId} admin-da, open state unchanged. Marking synced.`,
                );
                await OrdersModel.update(
                  { is_synced: 1 },
                  { where: { uuid: orderId }, paranoid: false },
                ).catch(() => {});
                this._retryCounts.delete(orderId);
                this.lastSyncTime = new Date();
                return;
              }

              throw new Error(
                `409 conflict on non-open order (${orderId}); keeping pending for retry`,
              );
            }
            throw retryErr;
          }
        } else {
          throw firstErr;
        }
      }

      // Retry DB update up to 3 times to ensure is_synced=1 is saved even under DB load
      let marked = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await OrdersModel.update(
            { is_synced: 1 },
            { where: { uuid: orderId }, paranoid: false },
          );
          marked = true;
          break;
        } catch (dbErr) {
          console.warn(
            `[SYNC_DB_RETRY] Attempt ${attempt} failed for ${orderId}: ${dbErr.message}`,
          );
          if (attempt < 3)
            await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
      if (!marked) {
        console.error(
          `[SYNC_DB_FAIL] Could not mark ${orderId} as synced after 3 attempts`,
        );
      }

      this._retryCounts.delete(orderId);
      this.lastSyncTime = new Date();
      // Clear stale error on successful sync — shows UI that syncing is recovering
      this.clearLastSyncError();
      console.log(`[SYNC] Success: ${orderId}`);
    } catch (error) {
      console.error(`[SYNC_FAIL] ${orderId}: ${error.message}`);
      if (error.isAlreadySynced) {
        // 409 may be safe only for open orders; for closed/deleted orders we must retry
        const latest = await OrdersModel.findOne({
          where: { uuid: orderId },
          paranoid: false,
          attributes: ["status", "deleted_at"],
        }).catch(() => null);
        const latestIsDeleted = !!(
          latest?.get?.("deleted_at") || latest?.get?.("deletedAt")
        );
        const latestStatus = Number(latest?.status);

        if (latestStatus === 1 && !latestIsDeleted) {
          console.log(
            `[SYNC_ALREADY] Order ${orderId} already on admin, open state unchanged. Marking synced.`,
          );
          await OrdersModel.update(
            { is_synced: 1 },
            { where: { uuid: orderId }, paranoid: false },
          ).catch(() => {});
          this._retryCounts.delete(orderId);
          return;
        }

        this.recordSyncFailure(
          orderId,
          new Error(
            `409 conflict on closed/deleted order ${orderId}; retry required`,
          ),
        );
        throw error;
      }
      this.recordSyncFailure(orderId, error);
      if (error.isValidationError) {
        // 400/422 — itki olmasın, yenidən cəhd edəcək (heç vaxt skip yoxdur)
        console.warn(
          `[SYNC_VALIDATION] Order ${orderId} validation error (400/422), yenidən cəhd ediləcək...`,
        );
      }

      // Bütün xətalar (network, 5xx, 400/422) → stays is_synced=0, davam edəcək
      const retries = (this._retryCounts.get(orderId) || 0) + 1;
      this._retryCounts.set(orderId, retries);
      if (retries % 10 === 0) {
        console.warn(
          `[SYNC_RETRY] Order ${orderId} failed ${retries} times, yenidən cəhd ediləcək...`,
        );
      }
      throw error;
    }
  }

  async getCurrentProfileId() {
    const profile = await LoginModel.findOne({
      order: [["updated_at", "DESC"]],
    });
    return profile?.id || null;
  }

  async syncPendingOrders() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this._syncCycleStartedAt = Date.now();

    try {
      const isOnline = await this._withTimeout(
        this.checkConnectivity(),
        8000,
        "checkConnectivity",
      ).catch(() => false);
      if (!isOnline) {
        this.recordSyncFailure(
          null,
          new Error(
            "Avto-sync: internet və ya admin server əlçatan deyil (yoxlama vaxtı bitdi)",
          ),
        );
        return;
      }

      // Connectivity OK → clear any stale network/offline errors so UI doesn't show old messages
      if (
        this.lastSyncError &&
        typeof this.lastSyncError === "string" &&
        (this.lastSyncError.includes(
          "internet və ya admin server əlçatan deyil",
        ) ||
          this.lastSyncError.includes("EHOSTUNREACH") ||
          this.lastSyncError.includes("ECONNREFUSED") ||
          this.lastSyncError.includes("ENOTFOUND") ||
          this.lastSyncError.includes("ETIMEDOUT") ||
          this.lastSyncError.includes("ECONNRESET") ||
          this.lastSyncError.includes("connect "))
      ) {
        this.clearLastSyncError();
      }

      const pendingOrders = await OrdersModel.findAll({
        where: {
          [Op.or]: [{ is_synced: 0 }, { is_synced: null }],
        },
        paranoid: false,
        limit: SYNC_BATCH_LIMIT,
        order: [["updated_at", "DESC"]], // ən son dəyişənlər əvvəl — ən son halda qalmaq üçün
      });

      if (pendingOrders.length === 0) return;

      console.log(
        `[SYNC_LOOP] Found ${pendingOrders.length} pending orders. Processing...`,
      );

      const syncTasks = pendingOrders
        .filter((order) => !this._currentlySyncing.has(order.uuid))
        .map((order) => {
          this._currentlySyncing.add(order.uuid);
          return this._withTimeout(
            this.triggerSync(order.uuid),
            SYNC_ORDER_TIMEOUT_MS,
            `triggerSync(${order.uuid?.slice?.(0, 8) || order.uuid})`,
          )
            .catch((e) => {
              console.warn(`[SYNC_LOOP_SKIP] ${order.uuid}: ${e.message}`);
            })
            .finally(() => {
              this._currentlySyncing.delete(order.uuid);
            });
        });

      await Promise.allSettled(syncTasks);

      console.log("[SYNC_LOOP] Cycle complete.");
    } catch (error) {
      console.error("[SYNC_LOOP_CRITICAL]", error);
      this.recordSyncFailure(
        null,
        error?.message ? error : new Error(String(error)),
      );
    } finally {
      try {
        const stillPending = await OrdersModel.count({
          where: {
            [Op.or]: [{ is_synced: 0 }, { is_synced: null }],
          },
          paranoid: false,
        });
        if (stillPending === 0) {
          this.clearLastSyncError();
        }
      } catch (_) {
        /* ignore */
      }
      this.isSyncing = false;
      this._syncCycleStartedAt = 0;
    }
  }

  async checkConnectivity() {
    /**
     * Status modalı checkInternet ilə eyni ünvandan başla (Electron main.js).
     * Əvvəl yalnız discover + Google/Cloudflare idi — bəzən UI yaşıl, sync isə "offline" qalırdı.
     */
    const checks = [
      { url: "https://1.1.1.1", timeout: 1000 },
      { url: "http://1.1.1.1", timeout: 1000 },
      { url: "http://46.224.8.157:35627/api/discover", timeout: 1500 },
      {
        url: "https://api.unipos.tech/",
        timeout: 1500,
        validateStatus: () => true,
      },
    ];

    const oneCheck = (url, timeout, validateStatus) =>
      syncAxios
        .get(url, {
          timeout,
          validateStatus:
            validateStatus || ((status) => status > 0 && status < 500),
        })
        .then(() => true)
        .catch((e) => {
          if (e.response) return true;
          throw e;
        });

    try {
      await Promise.any(
        checks.map((c) => oneCheck(c.url, c.timeout, c.validateStatus)),
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

    // Log payload size for debugging
    const payloadSize = JSON.stringify(payload).length;
    const orderCount = payload.orders?.length || 0;
    const itemCount = payload.items?.length || 0;
    console.log(
      `[SYNC_SEND] Sending: ${orderCount} orders, ${itemCount} items, payload size: ${(payloadSize / 1024).toFixed(1)}KB`,
    );

    // Try both URLs in parallel, use whichever responds first
    try {
      await Promise.any(
        urls.map((url) =>
          syncAxios
            .post(url, payload, { timeout: 30000 })
            .then((res) => {
              // 2xx = success
              if (res.status >= 200 && res.status < 300) {
                console.log(
                  `[SYNC_SEND] Success via ${url}, status: ${res.status}`,
                );
                return true;
              }
              throw new Error(`Unexpected status ${res.status}`);
            })
            .catch((error) => {
              const status = error.response?.status;

              // 409 Conflict = data already exists on admin → treat as success
              if (status === 409) {
                const alreadyErr = new Error(
                  `Admin already has this order (409)`,
                );
                alreadyErr.isAlreadySynced = true;
                throw alreadyErr;
              }

              // 400/422 = permanent data error, don't retry
              if (status === 400 || status === 422) {
                const validationErr = new Error(
                  `Admin API Validation Error: ${status} - ${JSON.stringify(error.response?.data)}`,
                );
                validationErr.isValidationError = true;
                throw validationErr;
              }

              // Everything else (404, 5xx, network) = retryable
              lastError = error;
              console.warn(
                `[SYNC_URL_FAIL] ${url} (${status || error.code}): ${error.message}`,
              );
              throw error;
            }),
        ),
      );
      return true;
    } catch (aggregateError) {
      const errors = aggregateError?.errors || [];

      // If any URL said "already synced" → treat as success
      const alreadySynced = errors.find((e) => e?.isAlreadySynced);
      if (alreadySynced) throw alreadySynced;

      // If any URL returned a permanent validation error → skip forever
      const validationErr = errors.find((e) => e?.isValidationError);
      if (validationErr) throw validationErr;

      throw lastError || new Error("All sync endpoints failed");
    }
  }
}

module.exports = new SyncService();

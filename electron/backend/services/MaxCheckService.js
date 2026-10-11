const axios = require("axios");
const https = require("https");
const OrdersModel = require("../model/OrdersModel");
const LoginModel = require("../model/LoginModel");

/**
 * Maksimum çek nömrəsinin serverləri.
 *
 * İki serverin YOLU VƏ SAHƏ ADLARI FƏRQLİDİR, ona görə hər biri ayrıca təsvir
 * olunur. Əvvəl ehtiyat ünvan da `/api/max-checks` + `profile_id` / `max_id`
 * kimi çağırılırdı, qrapi-də isə belə bir route yoxdur — həmişə 404 qaytarırdı.
 * Əsas server işlədiyi üçün problem görünmürdü, amma o düşəndə ehtiyat da
 * işləməzdi. Mənbə: QR_ORDER_SOCKET_PLAN.md, 8-ci bənd.
 */
const MAX_CHECK_ENDPOINTS = [
    {
        name: "api.unipos.tech",
        get: (profileId) => ({
            url: "https://api.unipos.tech/api/max-checks",
            params: { profile_id: profileId },
        }),
        post: (profileId, maxId) => ({
            url: "https://api.unipos.tech/api/max-checks",
            body: { profile_id: profileId, max_id: maxId },
        }),
    },
    {
        name: "qrapi",
        get: (profileId) => ({
            url: `http://46.224.8.157:35627/api/pos/max-checks/${profileId}`,
            params: undefined,
        }),
        post: (profileId, maxId) => ({
            url: "http://46.224.8.157:35627/api/pos/max-checks",
            body: { profileId, maxId },
        }),
    },
];

// Node.js v24+ defaults to TLS 1.2 minimum, but server uses older TLS
const tlsAgent = new https.Agent({ rejectUnauthorized: false, minVersion: 'TLSv1' });

class MaxCheckService {
    constructor() {
        this.cachedServerMaxId = 0;
        this.cachedLocalMaxId = 0;
        this._syncInFlight = false;
        this._lastProfileId = null;
        this._pendingSyncMaxId = null; // tracks unsent max ID for retry
        this._offlineMode = false;     // skip admin API calls when no internet

        // Periodic retry: every 30s check if local > server and push to server
        setInterval(() => {
            this._periodicSync().catch(err =>
                console.warn("[MAX_CHECK] Periodic sync error:", err.message)
            );
        }, 30000);
    }

    async _periodicSync() {
        const profileId = this._lastProfileId;
        if (!profileId) return;

        const dbMax = (await OrdersModel.max("id", { paranoid: false })) || 0;
        if (dbMax > this.cachedLocalMaxId) {
            this.cachedLocalMaxId = dbMax;
        }

        const localMax = this.cachedLocalMaxId;
        const maxToSync = this._pendingSyncMaxId
            ? Math.max(localMax, this._pendingSyncMaxId)
            : localMax;

        if (maxToSync > 0 && maxToSync > this.cachedServerMaxId) {
            console.log(`[MAX_CHECK] Periodic sync: pushing maxId=${maxToSync} to server (cached server: ${this.cachedServerMaxId})`);
            const ok = await this.syncMaxIdToServer(profileId, maxToSync);
            if (ok) {
                this._pendingSyncMaxId = null;
                this._offlineMode = false; // sync uğurlu oldu — online-a qayıt
            }
        } else {
            // Heç bir sync lazım deyil, amma offline-dirsak bir də serveri yoxla
            if (this._offlineMode) {
                // force=true — offline olsaq da admin API-ə cəhd et
                const serverMax = await this.fetchServerMaxId(profileId, true);
                if (serverMax > 0) {
                    this._offlineMode = false;
                }
            }
        }
    }

    async fetchServerMaxId(profileId, force = false) {
        // Əgər offline rejimindəyik, admin API-ə heç cəhd etmə — local DB kifayətdir
        // force=true olanda (periodic sync) yenə cəhd edir
        if (!force && this._offlineMode) {
            console.log(`[MAX_CHECK] Offline mode: skipping server fetch, using cached: ${this.cachedServerMaxId}`);
            return this.cachedServerMaxId;
        }

        for (const ep of MAX_CHECK_ENDPOINTS) {
            const { url, params } = ep.get(profileId);
            try {
                const response = await axios.get(url, {
                    params,
                    timeout: 2000,  // 5s → 2s: offline olanda tez cavab ver
                    httpsAgent: tlsAgent,
                });
                if (response.status === 200 && response.data != null) {
                    const d = response.data;
                    const serverMax = Number(
                        d?.max_id ??
                        d?.data?.max_id ??
                        d?.data?.[0]?.max_id ??
                        d?.maxId ??
                        d?.data?.maxId ??
                        0
                    ) || 0;
                    this.cachedServerMaxId = serverMax;
                    this._offlineMode = false; // admin API cavab verdi — online
                    console.log(`[MAX_CHECK] Server max ID: ${serverMax} (profile: ${profileId}, url: ${url})`);
                    return serverMax;
                }
            } catch (e) {
                console.warn(`[MAX_CHECK] GET ${url} failed — status: ${e.response?.status}, error: ${e.message}`);
            }
        }
        // Hər iki URL cəhdi uğursuz oldu — offline rejiminə keç
        this._offlineMode = true;
        console.warn(`[MAX_CHECK] Could not reach server. Entering offline mode. Using cached: ${this.cachedServerMaxId}`);
        return this.cachedServerMaxId;
    }

    async syncMaxIdToServer(profileId, maxId) {
        for (const ep of MAX_CHECK_ENDPOINTS) {
            const { url, body } = ep.post(profileId, maxId);
            try {
                const response = await axios.post(url, body, { timeout: 5000, httpsAgent: tlsAgent });
                if (response.data?.success || response.status === 200) {
                    const returnedMax =
                        Number(response.data?.max_id ?? response.data?.maxId) || maxId;
                    this.cachedServerMaxId = returnedMax;
                    console.log(`[MAX_CHECK] Synced maxId=${returnedMax} to server (profile: ${profileId}), status: ${response.status}, url: ${url}`);
                    return true;
                }
            } catch (e) {
                const status = e.response?.status;
                const respData = e.response?.data;
                console.warn(`[MAX_CHECK] POST ${url} failed — status: ${status}, error: ${e.message}, response:`, respData || 'no response');
            }
        }
        console.warn(`[MAX_CHECK] Failed to sync maxId=${maxId} to server (profile: ${profileId}). Will retry later.`);
        return false;
    }

    /**
     * Called after an order is created with a client-provided ID
     * to ensure both local cache and server stay up-to-date.
     */
    reportUsedId(profileId, usedId) {
        const id = Number(usedId);
        if (!id || id <= 0) return;
        this._lastProfileId = profileId;

        if (id > this.cachedLocalMaxId) {
            this.cachedLocalMaxId = id;
            console.log(`[MAX_CHECK] reportUsedId: updated cachedLocalMaxId to ${id}`);
        }

        if (id > this.cachedServerMaxId) {
            this._pendingSyncMaxId = id;
            this.syncMaxIdToServer(profileId, id)
                .then((ok) => {
                    if (ok) this._pendingSyncMaxId = null;
                })
                .catch(() => { });
        }
    }

    async getNextId(profileId) {
        this._lastProfileId = profileId;

        // Always refresh local max from DB to avoid stale cache
        const dbMax = (await OrdersModel.max("id", { paranoid: false })) || 0;
        if (dbMax > this.cachedLocalMaxId) {
            this.cachedLocalMaxId = dbMax;
        }
        let localMax = this.cachedLocalMaxId;

        let serverMax = this.cachedServerMaxId;
        // Admin API-dən ancaq cache boşdursa və offline deyilsək sorğula
        if (serverMax === 0 && !this._offlineMode) {
            try {
                serverMax = await this.fetchServerMaxId(profileId);
            } catch (e) {
                console.warn("[MAX_CHECK] Server fetch failed, using cache:", serverMax);
            }
        }

        const effectiveMax = Math.max(localMax, serverMax);
        const nextId = effectiveMax + 1;

        this.cachedLocalMaxId = nextId;

        // Sync to server — track pending in case it fails (periodic retry will pick it up)
        this._pendingSyncMaxId = nextId;
        this.syncMaxIdToServer(profileId, nextId)
            .then((ok) => {
                if (ok) this._pendingSyncMaxId = null;
            })
            .catch(() => { });

        console.log(`[MAX_CHECK] Next ID: ${nextId} (local: ${localMax}, server: ${serverMax})`);
        return nextId;
    }

    async fetchAndSyncOnStartup(profileId) {
        this._lastProfileId = profileId;
        try {
            const localMax = (await OrdersModel.max("id", { paranoid: false })) || 0;
            this.cachedLocalMaxId = localMax;
            // force=false — offline-dirsa start-upda admin API-ə cəhd etmə, tez başlasın
            const serverMax = await this.fetchServerMaxId(profileId, true);
            const effectiveMax = Math.max(localMax, serverMax);

            if (localMax > serverMax && localMax > 0) {
                const ok = await this.syncMaxIdToServer(profileId, localMax);
                if (ok) {
                    console.log(`[MAX_CHECK] Startup: local (${localMax}) > server (${serverMax}), synced to server.`);
                } else {
                    this._pendingSyncMaxId = localMax;
                    console.warn(`[MAX_CHECK] Startup: local (${localMax}) > server (${serverMax}), sync FAILED — will retry.`);
                }
            } else if (serverMax > localMax) {
                console.log(`[MAX_CHECK] Startup: server (${serverMax}) > local (${localMax}), will use server max.`);
            } else {
                console.log(`[MAX_CHECK] Startup: IDs in sync at ${effectiveMax}.`);
            }
        } catch (e) {
            console.warn("[MAX_CHECK] Startup sync failed:", e.message);
        }
    }
}

module.exports = new MaxCheckService();

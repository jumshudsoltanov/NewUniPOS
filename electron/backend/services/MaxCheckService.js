const axios = require("axios");
const OrdersModel = require("../model/OrdersModel");
const LoginModel = require("../model/LoginModel");

const ADMIN_API_URL = "https://api.unipos.tech/api/pos/max-checks";
const ADMIN_API_FALLBACK_URL = "http://46.224.8.157:35627/api/pos/max-checks";

class MaxCheckService {
    constructor() {
        this.cachedServerMaxId = 0;
    }

    async fetchServerMaxId(profileId) {
        const urls = [`${ADMIN_API_URL}/${profileId}`, `${ADMIN_API_FALLBACK_URL}/${profileId}`];
        for (const url of urls) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                if (response.status === 200 && response.data != null) {
                    const serverMax = Number(response.data.maxId || response.data.max_id || response.data) || 0;
                    this.cachedServerMaxId = serverMax;
                    console.log(`[MAX_CHECK] Server max ID: ${serverMax} (profile: ${profileId})`);
                    return serverMax;
                }
            } catch (e) {
                if (e.response) {
                    console.warn(`[MAX_CHECK] Server responded with ${e.response.status} from ${url}`);
                }
            }
        }
        console.warn(`[MAX_CHECK] Could not reach server. Using cached: ${this.cachedServerMaxId}`);
        return this.cachedServerMaxId;
    }

    async syncMaxIdToServer(profileId, maxId) {
        const urls = [ADMIN_API_URL, ADMIN_API_FALLBACK_URL];
        for (const url of urls) {
            try {
                await axios.post(url, { profileId, maxId }, { timeout: 5000 });
                this.cachedServerMaxId = maxId;
                console.log(`[MAX_CHECK] Synced maxId=${maxId} to server (profile: ${profileId})`);
                return true;
            } catch (e) {
                // silent
            }
        }
        console.warn(`[MAX_CHECK] Failed to sync maxId=${maxId} to server. Will retry later.`);
        return false;
    }

    async getNextId(profileId) {
        const localMax = (await OrdersModel.max("id", { paranoid: false })) || 0;
        let serverMax = 0;

        try {
            serverMax = await this.fetchServerMaxId(profileId);
        } catch (e) {
            console.warn("[MAX_CHECK] Server fetch failed, using local only.");
        }

        const effectiveMax = Math.max(localMax, serverMax);
        const nextId = effectiveMax + 1;

        this.syncMaxIdToServer(profileId, nextId).catch(() => { });

        console.log(`[MAX_CHECK] Next ID: ${nextId} (local: ${localMax}, server: ${serverMax})`);
        return nextId;
    }

    async fetchAndSyncOnStartup(profileId) {
        try {
            const localMax = (await OrdersModel.max("id", { paranoid: false })) || 0;
            const serverMax = await this.fetchServerMaxId(profileId);
            const effectiveMax = Math.max(localMax, serverMax);

            if (localMax > serverMax && localMax > 0) {
                await this.syncMaxIdToServer(profileId, localMax);
                console.log(`[MAX_CHECK] Startup: local (${localMax}) > server (${serverMax}), synced to server.`);
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

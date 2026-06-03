import axios from "axios";
import { io } from "socket.io-client";

/** Fiskal (Sunmi və s.) əməliyyatları uzun çəkə bilər — 30s kifayət etmir */
export const TAX_HTTP_TIMEOUT_MS = 240000;

const apiConfig = axios.create({
    baseURL: "http://127.0.0.1:55667/api",
    timeout: 30000,
});

export const localApi = axios.create({
    baseURL: "http://127.0.0.1:55667/api",
    timeout: 30000,
});

let socket = null;
let _socketStatusCallback = null;

// Called by App.jsx to get real-time connect/disconnect events
export const onSocketStatusChange = (cb) => {
    _socketStatusCallback = cb;
};

const attachSocketStatusListeners = (s) => {
    if (!s || !_socketStatusCallback) return;
    s.on("connect",    () => _socketStatusCallback(true));
    s.on("disconnect", () => _socketStatusCallback(false));
    s.on("connect_error", () => _socketStatusCallback(false));
};

export const initNetwork = async (forceLocal = false, disableSocket = false, directMasterIp = null) => {
    // 1. Clean up existing socket if it exists to prevent leaks
    if (socket) {
        console.warn("[CONNECTION] Cleaning up existing socket before re-init...");
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        if (_socketStatusCallback) _socketStatusCallback(false);
    }

    // Birbaşa Master IP — skan etmədən, statik IP ilə qoşul (ping işləyirsə bu da işləməlidir)
    if (directMasterIp && directMasterIp.trim()) {
        const ip = directMasterIp.trim();
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
            const baseURL = `http://${ip}:55667`;
            console.warn(`[CONNECTION] Birbaşa qoşulma: ${baseURL} (skan yox)`);
            apiConfig.defaults.baseURL = `${baseURL}/api`;
            if (!disableSocket) {
                socket = io(baseURL, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    timeout: 15000,
                });
                attachSocketStatusListeners(socket);
                socket.on("connect", () => {
                    console.warn(`[CONNECTION] Slave qoşuldu: ${baseURL}`);
                });
                socket.on("connect_error", (err) => {
                    console.error("[CONNECTION] Birbaşa qoşulma xətası:", err.message);
                });
            }
            return { masterIp: ip, socket };
        }
    }

    if (!window.electronAPI) {
        // Web/Mobile mode: Determine Master IP from URL parameter, localStorage, or current hostname
        const searchParams = new URLSearchParams(window.location.search);

        // Also check hash for params (sometimes routers move them there)
        const hashSearch = window.location.hash.includes('?')
            ? new URLSearchParams(window.location.hash.split('?')[1])
            : new URLSearchParams();

        const urlMasterIp = searchParams.get('master_ip') || hashSearch.get('master_ip');
        const savedMasterIp = localStorage.getItem('master_ip');

        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

        // Priority: 1. URL Param, 2. Saved in LocalStorage, 3. Current Hostname (if not localhost)
        const effectiveIp = urlMasterIp || savedMasterIp || (!isLocalhost ? hostname : null);

        if (effectiveIp) {
            // Save it for future sessions without the URL param if it's a real IP/hostname
            if (urlMasterIp) {
                localStorage.setItem('master_ip', urlMasterIp);
            }

            const baseURL = `http://${effectiveIp}:55667`;
            console.warn(`[CONNECTION] Mobile/Web Mode: Connecting to ${baseURL} (Source: ${urlMasterIp ? 'URL Param' : (savedMasterIp ? 'LocalStorage' : 'Fallback Hostname')})`);
            apiConfig.defaults.baseURL = `${baseURL}/api`;
            
            socket = io(baseURL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                autoConnect: true,
                forceNew: true
            });
            attachSocketStatusListeners(socket);
            socket.on("connect_error", (err) => {
                console.error("[CONNECTION] Mobile Socket Connect Error:", err.message);
            });

            return { masterIp: effectiveIp, socket };
        }
    }

    if (!forceLocal && window.electronAPI && window.electronAPI.scanMaster) {
        try {
            console.warn("[CONNECTION] Scanning for Master Terminal...");
            let masterIp = null;
            const maxAttempts = 3;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                masterIp = await window.electronAPI.scanMaster();
                if (masterIp) break;
                if (attempt < maxAttempts) {
                    console.warn(`[CONNECTION] Master tapılmadı, ${attempt}/${maxAttempts} cəhd. 1 saniyə sonra yenidən...`);
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }

            if (masterIp) {
                const baseURL = `http://${masterIp}:55667`;
                apiConfig.defaults.baseURL = `${baseURL}/api`;

                if (!disableSocket) {
                    socket = io(baseURL, {
                        transports: ['websocket', 'polling'],
                        reconnection: true,
                        reconnectionAttempts: Infinity,
                        reconnectionDelay: 1000,
                        reconnectionDelayMax: 5000,
                        timeout: 10000,
                    });
                    attachSocketStatusListeners(socket);
                    socket.on("connect", () => {
                        console.warn(`[CONNECTION] Connected as SLAVE to Master Terminal at ${baseURL}`);
                    });
                    socket.on("connect_error", (err) => {
                        console.error("[CONNECTION] Socket Connect Error:", err.message);
                    });
                }
                return { masterIp, socket };
            }
        } catch (e) {
            console.error("Master tapılmadı, lokalda davam edilir", e);
        }
    }

    // Fallback to local (only if forceLocal is true or it's genuinely the Electron Master)
    if (!disableSocket && (forceLocal || (window.electronAPI && !window.electronAPI.scanMaster))) {
        socket = io("http://127.0.0.1:55667", {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
        });
        attachSocketStatusListeners(socket);
        socket.on("connect", () => {
            console.warn("[CONNECTION] Connected as MASTER (Local Database)");
        });
    } else if (!disableSocket && !forceLocal) {
        // Essential: If it was scanning for a master (Slave) and failed, it must NOT connect to localhost
        console.warn("[CONNECTION] Slave/Mobile failed to find Master. Network blocked.");
        apiConfig.defaults.baseURL = `http://${window.location.hostname}:55667/api`;
        socket = null;
    } else {
        console.warn("[CONNECTION] Running in Standalone Mode. Sockets explicitly deactivated.");
        socket = null;
    }

    return { masterIp: forceLocal ? "127.0.0.1" : null, socket };
};

export const getSocket = () => socket;

export default apiConfig;

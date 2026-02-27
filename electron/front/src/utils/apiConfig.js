import axios from "axios";
import { io } from "socket.io-client";

const apiConfig = axios.create({
    baseURL: "http://localhost:55667/api",
});

export const localApi = axios.create({
    baseURL: "http://localhost:55667/api",
});

let socket = null;

export const initNetwork = async (forceLocal = false, disableSocket = false) => {
    // 1. Clean up existing socket if it exists to prevent leaks
    if (socket) {
        console.warn("[CONNECTION] Cleaning up existing socket before re-init...");
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }

    if (!window.electronAPI) {
        // Web/Mobile mode: Always use the current hostname as the Master IP
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

        if (!isLocalhost) {
            const baseURL = `http://${hostname}:55667`;
            console.warn(`[CONNECTION] Mobile/Web Mode: Connecting to ${baseURL}`);
            apiConfig.defaults.baseURL = `${baseURL}/api`;

            if (!disableSocket) {
                socket = io(baseURL, {
                    transports: ['websocket', 'polling']
                });
            }
            return { masterIp: hostname, socket };
        }
    }

    if (!forceLocal && window.electronAPI && window.electronAPI.scanMaster) {
        try {
            console.warn("[CONNECTION] Scanning for Master Terminal...");
            const masterIp = await window.electronAPI.scanMaster();

            if (masterIp) {
                const baseURL = `http://${masterIp}:55667`;
                apiConfig.defaults.baseURL = `${baseURL}/api`;

                if (!disableSocket) {
                    socket = io(baseURL, {
                        transports: ['websocket', 'polling'],
                        reconnection: true,
                        reconnectionAttempts: Infinity,
                        reconnectionDelay: 1000
                    });

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
        socket = io("http://localhost:55667", {
            transports: ['websocket', 'polling']
        });
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

    return { masterIp: forceLocal ? "localhost" : null, socket };
};

export const getSocket = () => socket;

export default apiConfig;

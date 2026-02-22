import axios from "axios";
import { io } from "socket.io-client";

const apiConfig = axios.create({
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

    if (!forceLocal && window.electronAPI && window.electronAPI.scanMaster) {
        try {
            console.warn("[CONNECTION] Scanning for Master Terminal...");
            const masterIp = await window.electronAPI.scanMaster();

            if (masterIp) {
                const baseURL = `http://${masterIp}:55667`;
                apiConfig.defaults.baseURL = `${baseURL}/api`;

                if (!disableSocket) {
                    // Force WebSocket first to avoid polling 404s and reduce overhead
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
    if (!disableSocket && forceLocal) {
        socket = io("http://localhost:55667", {
            transports: ['websocket', 'polling']
        });
        socket.on("connect", () => {
            console.warn("[CONNECTION] Connected as MASTER (Local Database)");
        });
    } else if (!disableSocket && !forceLocal) {
        // Essential: If it was scanning for a master (Slave) and failed, it must NOT connect to localhost
        console.warn("[CONNECTION] Slave failed to find Master. Network blocked.");
        apiConfig.defaults.baseURL = "http://255.255.255.255/api"; // Force immediate Axios timeout
        socket = null;
    } else {
        console.warn("[CONNECTION] Running in Standalone Mode. Sockets explicitly deactivated.");
        socket = null;
    }

    return { masterIp: forceLocal ? "localhost" : null, socket };
};

export const getSocket = () => socket;

export default apiConfig;

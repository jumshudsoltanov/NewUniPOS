import axios from "axios";
import { io } from "socket.io-client";

const apiConfig = axios.create({
    baseURL: "http://localhost:55667/api",
});

let socket = null;

export const initNetwork = async (forceLocal = false) => {
    if (!forceLocal && window.electronAPI && window.electronAPI.scanMaster) {
        try {
            const masterIp = await window.electronAPI.scanMaster();
            if (masterIp) {
                const baseURL = `http://${masterIp}:55667`;
                apiConfig.defaults.baseURL = `${baseURL}/api`;

                socket = io(baseURL);
                socket.on("connect", () => {
                    console.warn(`[CONNECTION] Connected as SLAVE to Master Terminal at ${baseURL}`);
                });
                return { masterIp, socket };
            }
        } catch (e) {
            console.error("Master tapılmadı, lokalda davam edilir", e);
        }
    }

    // Fallback to local (only if forceLocal is true or it's genuinely the Electron Master)
    socket = io("http://localhost:55667");
    socket.on("connect", () => {
        console.warn("[CONNECTION] Connected as MASTER (Local Database)");
    });
    return { masterIp: "localhost", socket };
};

export const getSocket = () => socket;

export default apiConfig;

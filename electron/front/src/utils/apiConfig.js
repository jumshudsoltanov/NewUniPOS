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
                    console.log(`✅ Master terminalı ilə əlaqə quruldu (${baseURL})`);
                });
                return { masterIp, socket };
            }
        } catch (e) {
            console.error("Master tapılmadı, lokalda davam edilir", e);
        }
    }

    // Fallback to local
    socket = io("http://localhost:55667");
    socket.on("connect", () => {
        console.log("✅ Lokal Socket serverə qoşuldu");
    });
    return { masterIp: "localhost", socket };
};

export const getSocket = () => socket;

export default apiConfig;

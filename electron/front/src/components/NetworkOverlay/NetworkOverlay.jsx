import React, { useEffect, useState } from "react";
import { getSocket, initNetwork } from "../../utils/apiConfig";

const NetworkOverlay = () => {
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [masterIp, setMasterIp] = useState("Axtarılır...");
    const [slaveIp, setSlaveIp] = useState("...");

    useEffect(() => {
        let pollingInterval;
        let retryCounter = 0;

        // Continuous network verification loop for Slaves
        const verifyConnection = async () => {
            const authResult = JSON.parse(localStorage.getItem("authResult"));
            let isConfiguredSlave = false;
            let isMaster = false;
            let isMasterSlaveActive = false;

            if (authResult) {
                const profileData = authResult?.data?.profile || {};
                const terminalData = authResult?.data?.terminal || {};
                isMaster = terminalData.is_master == 1 || profileData.is_master == 1;
                isMasterSlaveActive = terminalData.is_master_slave_active == 1 || profileData.is_master_slave_active == 1;

                if (!isMaster && isMasterSlaveActive) {
                    isConfiguredSlave = true;
                }
            }

            const socket = getSocket();

            // If we are a slave and disconnected, try a background re-scan occasionally
            if ((!socket || !socket.connected) && isConfiguredSlave) {
                setIsDisconnected(true);

                // Every 5 iterations (roughly 10 seconds), attempt a background re-init
                retryCounter++;
                if (retryCounter >= 5) {
                    console.warn("[NETWORK] Background re-scan started...");
                    retryCounter = 0;
                    try {
                        const result = await initNetwork(false, false);
                        if (result && result.socket) {
                            console.warn("[NETWORK] Master found in background!");
                            setIsDisconnected(false);
                        }
                    } catch (e) {
                        console.error("[NETWORK] Background re-scan failed:", e.message);
                    }
                }
                return;
            }

            // If we have a socket, we need to check if it's actually remote and connected
            if (socket) {
                let uri = socket.io?.uri || "";
                let isRemoteSocket = !uri.includes("localhost") && !uri.includes("127.0.0.1");
                let isConnectedToMaster = socket.connected;

                if (isConfiguredSlave || isRemoteSocket) {
                    if (!isConnectedToMaster) {
                        setIsDisconnected(true);
                    } else {
                        setIsDisconnected(false);
                        retryCounter = 0; // Reset counter on successful connection
                    }
                }
            } else {
                // No socket and not a slave? Usually master/local mode.
                setIsDisconnected(false);
            }

            if (socket) {
                socket.off("disconnect").on("disconnect", () => {
                    if (isConfiguredSlave) setIsDisconnected(true);
                });
                socket.off("connect").on("connect", () => {
                    setIsDisconnected(false);
                    retryCounter = 0;
                });
            }
        };

        verifyConnection(); // Immediate check
        pollingInterval = setInterval(verifyConnection, 2000); // 2-second continuous heartbeat

        return () => clearInterval(pollingInterval);
    }, []);

    if (!isDisconnected) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(18, 20, 28, 0.95)", // Much closer to custom POS dark themes
                backdropFilter: "blur(12px)",
                color: "white",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 9999999,
                padding: "20px",
                textAlign: "center",
                fontFamily: "'Inter', sans-serif"
            }}
        >
            <div style={{ marginBottom: "25px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: "5rem", color: "#4F85F4" }}></i>
            </div>

            <h1 style={{ fontSize: "2.8rem", fontWeight: "700", marginBottom: "15px", color: "#FFFFFF", letterSpacing: "-0.5px" }}>
                Şəbəkə Əlaqəsi Kəsildi
            </h1>
            <p style={{ fontSize: "1.15rem", color: "#A0AEC0", maxWidth: "600px", lineHeight: "1.6", marginBottom: "35px" }}>
                Master terminal ilə əlaqə qurmaq mümkün olmadı. Zəhmət olmasa şəbəkə bağlantısını (Wi-Fi/LAN) və ya Master kompyuterin açıq olub-olmadığını yoxlayın.
            </p>

            <div style={{
                display: "flex",
                gap: "50px",
                background: "#1A202C",
                padding: "25px 50px",
                borderRadius: "16px",
                border: "1px solid #2D3748",
                boxShadow: "0 10px 25px rgba(0,0,0,0.3)"
            }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", color: "#718096", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>Master İP ünvanı</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#4F85F4" }}>{masterIp || "Bilinmir"}</div>
                </div>
                <div style={{ width: "1px", background: "#2D3748" }}></div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", color: "#718096", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>Sizin İP ünvanınız (Slave)</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#4F85F4" }}>{slaveIp || "Bilinmir"}</div>
                </div>
            </div>

            <div style={{ marginTop: "50px", display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.05)", padding: "12px 24px", borderRadius: "50px" }}>
                <div className="spinner-border spinner-border-sm" style={{ color: "#4F85F4", width: "1.2rem", height: "1.2rem" }} role="status"></div>
                <span style={{ color: "#CBD5E0", fontSize: "1rem", fontWeight: "500" }}>Yenidən bağlanmağa cəhd edilir...</span>
            </div>

            <button
                onClick={() => {
                    if (window.electronAPI && window.electronAPI.minimizeApp) {
                        window.close();
                    } else {
                        window.close();
                    }
                }}
                style={{
                    marginTop: "35px",
                    padding: "12px 30px",
                    backgroundColor: "#4F85F4",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "1.05rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(79, 133, 244, 0.4)",
                    transition: "all 0.2s ease"
                }}
            >
                <i className="bi bi-power me-2"></i> Sistemdən Çıxış (Bağla)
            </button>
        </div>
    );
};

export default NetworkOverlay;

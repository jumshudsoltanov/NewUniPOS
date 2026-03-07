import React, { useEffect, useRef, useState } from "react";
import { getSocket, initNetwork } from "../../utils/apiConfig";

const NetworkOverlay = () => {
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [masterIp, setMasterIp] = useState("Axtarılır...");

    useEffect(() => {
        let pollingInterval;
        let registeredSocket = null;

        const onDisconnect = () => setIsDisconnected(true);
        const onConnect = () => setIsDisconnected(false);

        const isSlave = () => {
            if (!window.electronAPI && !!localStorage.getItem('master_ip')) return true;
            const authResult = JSON.parse(localStorage.getItem("authResult") || "null");
            if (!authResult) return false;
            const profileData = authResult?.data?.profile || {};
            const terminalData = authResult?.data?.terminal || {};
            const isMaster = terminalData.is_master == 1 || profileData.is_master == 1;
            const active = terminalData.is_master_slave_active == 1 || profileData.is_master_slave_active == 1;
            return !isMaster && active;
        };

        const poll = () => {
            if (!isSlave()) {
                setIsDisconnected(false);
                return;
            }

            const socket = getSocket();

            // Re-register handlers only when socket instance changes
            if (socket !== registeredSocket) {
                if (registeredSocket) {
                    registeredSocket.off("disconnect", onDisconnect);
                    registeredSocket.off("connect", onConnect);
                }
                if (socket) {
                    socket.on("disconnect", onDisconnect);
                    socket.on("connect", onConnect);
                    const uri = socket.io?.uri || "";
                    if (uri.includes("://")) setMasterIp(uri.split("://")[1].split(":")[0]);
                }
                registeredSocket = socket;
            }

            // Sync current connection state
            setIsDisconnected(!socket || !socket.connected);
        };

        poll();
        pollingInterval = setInterval(poll, 3000);

        return () => {
            clearInterval(pollingInterval);
            if (registeredSocket) {
                registeredSocket.off("disconnect", onDisconnect);
                registeredSocket.off("connect", onConnect);
            }
        };
    }, []);

    if (!isDisconnected) return null;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(18, 20, 28, 0.95)",
                backdropFilter: "blur(12px)",
                color: "white",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 9999999,
                padding: isMobile ? "15px" : "20px",
                textAlign: "center",
                fontFamily: "'Inter', sans-serif"
            }}
        >
            <div style={{ marginBottom: isMobile ? "15px" : "25px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <span style={{ fontSize: isMobile ? "3rem" : "5rem" }}>⚠️</span>
            </div>

            <h1 style={{ fontSize: isMobile ? "1.4rem" : "2.8rem", fontWeight: "700", marginBottom: isMobile ? "10px" : "15px", color: "#FFFFFF", letterSpacing: "-0.5px" }}>
                Şəbəkə Əlaqəsi Kəsildi
            </h1>
            <p style={{ fontSize: isMobile ? "0.85rem" : "1.15rem", color: "#A0AEC0", maxWidth: "600px", lineHeight: "1.6", marginBottom: isMobile ? "20px" : "35px", padding: isMobile ? "0 10px" : "0" }}>
                Master terminal ilə əlaqə qurmaq mümkün olmadı. Zəhmət olmasa şəbəkə bağlantısını (Wi-Fi/LAN) və ya Master kompyuterin açıq olub-olmadığını yoxlayın.
            </p>

            <div style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? "15px" : "50px",
                background: "#1A202C",
                padding: isMobile ? "15px 20px" : "25px 50px",
                borderRadius: "16px",
                border: "1px solid #2D3748",
                boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                width: isMobile ? "90%" : "auto"
            }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: isMobile ? "0.7rem" : "0.85rem", color: "#718096", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>Master İP ünvanı</div>
                    <div style={{ fontSize: isMobile ? "1.1rem" : "1.6rem", fontWeight: "bold", color: "#4F85F4" }}>{masterIp || "Bilinmir"}</div>
                </div>
                <div style={{ width: isMobile ? "100%" : "1px", height: isMobile ? "1px" : "auto", background: "#2D3748" }}></div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: isMobile ? "0.7rem" : "0.85rem", color: "#718096", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>Sizin İP ünvanınız (Slave)</div>
                    <div style={{ fontSize: isMobile ? "1.1rem" : "1.6rem", fontWeight: "bold", color: "#4F85F4" }}>{window.location.hostname || "Bilinmir"}</div>
                </div>
            </div>

            <div style={{ marginTop: isMobile ? "25px" : "50px", display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.05)", padding: isMobile ? "10px 18px" : "12px 24px", borderRadius: "50px" }}>
                <div className="spinner-border spinner-border-sm" style={{ color: "#4F85F4", width: "1.2rem", height: "1.2rem" }} role="status"></div>
                <span style={{ color: "#CBD5E0", fontSize: isMobile ? "0.85rem" : "1rem", fontWeight: "500" }}>Yenidən bağlanmağa cəhd edilir...</span>
            </div>

            {!isMobile && (
                <button
                    onClick={() => {
                        if (window.electronAPI) {
                            window.close();
                        } else {
                            window.location.href = '/#/';
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
                    ⚠️ Sistemdən Çıxış (Bağla)
                </button>
            )}
        </div>
    );
};

export default NetworkOverlay;

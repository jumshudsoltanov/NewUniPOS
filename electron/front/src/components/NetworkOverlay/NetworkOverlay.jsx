import React, { useEffect, useState } from "react";
import { getSocket } from "../../utils/apiConfig";

const NetworkOverlay = () => {
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [masterIp, setMasterIp] = useState("Axtarılır...");
    const [slaveIp, setSlaveIp] = useState("...");

    useEffect(() => {
        let pollingInterval;

        const checkStatus = async () => {
            const storageData = JSON.parse(localStorage.getItem("profile"));
            const authResult = JSON.parse(localStorage.getItem("authResult"));
            if (!storageData || !authResult) return;

            const profileData = authResult?.data?.profile || {};
            const terminalData = authResult?.data?.terminal || {};

            const isMaster = terminalData.is_master === 1 || profileData.is_master === 1;
            const isMasterSlaveActive = terminalData.is_master_slave_active === 1 || profileData.is_master_slave_active === 1;

            // Standalone or actual Master never gets locked out by network
            if (isMaster || !isMasterSlaveActive) {
                setIsDisconnected(false);
                return;
            }

            const socket = getSocket();
            if (!socket) return;

            // Update IP addresses for display
            if (socket.io?.uri) {
                setMasterIp(socket.io.uri.replace("http://", "").replace(":55667", ""));
            }

            if (window.electronAPI && window.electronAPI.getLocalIp) {
                try {
                    const localIp = await window.electronAPI.getLocalIp();
                    setSlaveIp(localIp);
                } catch (e) { }
            }

            const handleDisconnect = () => setIsDisconnected(true);
            const handleConnect = () => setIsDisconnected(false);

            // Check immediate state
            setIsDisconnected(!socket.connected);

            socket.on("disconnect", handleDisconnect);
            socket.on("connect", handleConnect);

            return () => {
                socket.off("disconnect", handleDisconnect);
                socket.off("connect", handleConnect);
            };
        };

        // Since Socket initialization is async in App.jsx, poll until available
        pollingInterval = setInterval(() => {
            const socket = getSocket();
            if (socket) {
                clearInterval(pollingInterval);
                checkStatus();
            }
        }, 1000);

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
            <div style={{ marginBottom: "25px", animation: "pulseGlobal 2s infinite" }}>
                {/* Warning Icon using typical Primary mapping or White */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="90"
                    height="90"
                    fill="var(--primary-color, #4ABFB3)"
                    viewBox="0 0 16 16"
                >
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                </svg>
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
                    <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "var(--primary-color, #4ABFB3)" }}>{masterIp || "Bilinmir"}</div>
                </div>
                <div style={{ width: "1px", background: "#2D3748" }}></div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", color: "#718096", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>Sizin İP ünvanınız (Slave)</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "var(--primary-color, #4ABFB3)" }}>{slaveIp || "Bilinmir"}</div>
                </div>
            </div>

            <div style={{ marginTop: "50px", display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.05)", padding: "12px 24px", borderRadius: "50px" }}>
                <div className="spinner-border spinner-border-sm" style={{ color: "var(--primary-color, #4ABFB3)", width: "1.2rem", height: "1.2rem" }} role="status"></div>
                <span style={{ color: "#CBD5E0", fontSize: "1rem", fontWeight: "500" }}>Yenidən bağlanmağa cəhd edilir...</span>
            </div>
        </div>
    );
};

export default NetworkOverlay;

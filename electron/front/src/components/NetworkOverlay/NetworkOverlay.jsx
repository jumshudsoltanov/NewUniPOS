import React, { useEffect, useState } from "react";
import { getSocket } from "../../utils/apiConfig";
import { useNavigate } from "react-router-dom";
import "./NetworkOverlay.css";

const NetworkOverlay = () => {
    const navigate = useNavigate();
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [masterIp, setMasterIp] = useState(null);
    const [slaveIp, setSlaveIp] = useState(null);

    useEffect(() => {
        let pollingInterval;
        let registeredSocket = null;

        const onDisconnect = () => setIsDisconnected(true);
        const onConnect = () => setIsDisconnected(false);

        const isSlave = () => {
            try {
                if (!window.electronAPI && !!localStorage.getItem('master_ip')) return true;
                const authResultStr = localStorage.getItem("authResult");
                if (!authResultStr) return false;
                const authResult = JSON.parse(authResultStr);
                const profileData = authResult?.data?.profile || {};
                const terminalData = authResult?.data?.terminal || {};
                const isMaster = parseInt(terminalData.is_master) === 1 || parseInt(profileData.is_master) === 1;
                const active = parseInt(terminalData.is_master_slave_active) === 1 || parseInt(profileData.is_master_slave_active) === 1;
                return !isMaster && active;
            } catch {
                return false;
            }
        };

        const poll = () => {
            if (!isSlave()) { setIsDisconnected(false); return; }
            const socket = getSocket();
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
            setIsDisconnected(!socket || !socket.connected);
        };

        poll();
        pollingInterval = setInterval(poll, 3000);

        if (window.electronAPI?.getLocalIp) {
            window.electronAPI.getLocalIp().then(setSlaveIp).catch(() => {});
        } else {
            const h = window.location.hostname;
            if (h && h !== 'localhost' && h !== '127.0.0.1') setSlaveIp(h);
        }

        return () => {
            clearInterval(pollingInterval);
            if (registeredSocket) {
                registeredSocket.off("disconnect", onDisconnect);
                registeredSocket.off("connect", onConnect);
            }
        };
    }, []);

    if (!isDisconnected) return null;

    return (
        <div className="net-overlay">
            <div className="net-overlay__topbar" />

            <div className="net-overlay__card">
                <div className="net-overlay__logo">
                    <i className="bi bi-hdd-network" />
                </div>

                <div className="net-overlay__alert">
                    <div className="net-overlay__alert-icon">
                        <i className="bi bi-wifi-off" />
                    </div>
                    <div className="net-overlay__alert-text">
                        <div className="net-overlay__alert-title">Master ilə əlaqə kəsildi</div>
                        <div className="net-overlay__alert-sub">Şəbəkə bağlantısını yoxlayın</div>
                    </div>
                </div>

                <div className="net-overlay__sep" />

                <div className="net-overlay__grid">
                    <div className="net-overlay__cell">
                        <span className="net-overlay__cell-label">
                            <i className="bi bi-server" /> Master İP
                        </span>
                        <span className={`net-overlay__cell-value${masterIp ? "" : " muted"}`}>
                            {masterIp || "Axtarılır..."}
                        </span>
                    </div>
                    <div className="net-overlay__cell">
                        <span className="net-overlay__cell-label">
                            <i className="bi bi-pc-display" /> Sizin İP
                        </span>
                        <span className={`net-overlay__cell-value${slaveIp ? "" : " muted"}`}>
                            {slaveIp || "—"}
                        </span>
                    </div>
                </div>

                <div className="net-overlay__status">
                    <div className="net-overlay__spinner" />
                    <span>Yenidən bağlanmağa cəhd edilir...</span>
                </div>

                <button
                    className="net-overlay__exit"
                    onClick={() => {
                        if (window.electronAPI) window.close();
                        else navigate('/');
                    }}
                >
                    <i className="bi bi-box-arrow-left" />
                    Sistemdən çıx
                </button>
            </div>
        </div>
    );
};

export default NetworkOverlay;

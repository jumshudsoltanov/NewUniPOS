import React, { useEffect, useState, useRef } from "react";
import { getSocket, initNetwork } from "../../utils/apiConfig";
import { useNavigate } from "react-router-dom";
import "./NetworkOverlay.css";

const NetworkOverlay = () => {
    const navigate = useNavigate();
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [showFromSettings, setShowFromSettings] = useState(false);
    const [masterIp, setMasterIp] = useState(null);
    const [slaveIp, setSlaveIp] = useState(null);
    const [staticIpInput, setStaticIpInput] = useState("");
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [activeTab, setActiveTab] = useState("status");
    const hasAutoScanned = useRef(false);

    useEffect(() => {
        let pollingInterval;
        let registeredSocket = null;

        const onDisconnect = () => setIsDisconnected(true);
        const onConnect = () => setIsDisconnected(false);

        const isSlaveMode = () => {
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
            } catch { return false; }
        };

        const poll = () => {
            if (!isSlaveMode()) { setIsDisconnected(false); return; }
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
        pollingInterval = setInterval(poll, 5000);

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

    useEffect(() => {
        if ((isDisconnected || showFromSettings) && window.electronAPI?.getStaticMasterIp) {
            window.electronAPI.getStaticMasterIp().then(ip => setStaticIpInput(ip || "")).catch(() => {});
        }
    }, [isDisconnected, showFromSettings]);

    useEffect(() => {
        const handler = () => {
            setShowFromSettings(true);
            setActiveTab("ayarlar");
        };
        window.addEventListener("openMasterSlaveSettings", handler);
        return () => window.removeEventListener("openMasterSlaveSettings", handler);
    }, []);

    const isVisible = isDisconnected || showFromSettings;

    const handleAutoScan = async () => {
        if (!window.electronAPI?.scanMaster || isScanning) return;
        setIsScanning(true);
        try {
            const foundIp = await window.electronAPI.scanMaster();
            if (foundIp) {
                setStaticIpInput(foundIp);
                if (window.electronAPI?.setStaticMasterIp) {
                    await window.electronAPI.setStaticMasterIp(foundIp);
                }
                await initNetwork(false, false);
                window.location.reload();
            }
        } catch (e) {
            console.error("Scan error:", e);
        } finally {
            setIsScanning(false);
        }
    };

    const checkIsSlave = () => {
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

    useEffect(() => {
        if (!isVisible) {
            hasAutoScanned.current = false;
            return;
        }
        if (!checkIsSlave() || !window.electronAPI?.scanMaster || hasAutoScanned.current) return;
        hasAutoScanned.current = true;
        const runScan = async () => {
            setIsScanning(true);
            try {
                const foundIp = await window.electronAPI.scanMaster();
                if (foundIp) {
                    setStaticIpInput(foundIp);
                    if (window.electronAPI?.setStaticMasterIp) {
                        await window.electronAPI.setStaticMasterIp(foundIp);
                    }
                    await initNetwork(false, false);
                    window.location.reload();
                }
            } catch (e) {
                console.error("Scan error:", e);
            } finally {
                setIsScanning(false);
            }
        };
        runScan();
    }, [isVisible]);

    const handleConnect = async () => {
        const ip = staticIpInput.trim();
        if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return;
        setIsReconnecting(true);
        try {
            if (window.electronAPI?.setStaticMasterIp) {
                await window.electronAPI.setStaticMasterIp(ip);
            }
            // Birbaşa qoşul — skan etmədən (ping işləyirsə bu da işləyir)
            await initNetwork(false, false, ip);
            window.location.reload();
        } catch (e) {
            console.error("Reconnect error:", e);
        } finally {
            setIsReconnecting(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="net-overlay">
            <div className="net-overlay__card">
                <div className="net-overlay__header">
                    <div className="net-overlay__icon">
                        <i className="bi bi-wifi-off" />
                    </div>
                    <div className="net-overlay__header-text">
                        <h2 className="net-overlay__title">{showFromSettings ? "Master IP ayarları" : "Master ilə əlaqə kəsildi"}</h2>
                        <p className="net-overlay__desc">
                            {showFromSettings ? "Master serverə qoşulmaq üçün Statik IP, Axtar və ya Avto qoşul istifadə edin." : "Master server tapılmadı. Ayarlardan Statik IP, Axtar və ya Qoşul istifadə edin."}
                        </p>
                    </div>
                    {showFromSettings && (
                        <button className="net-overlay__close-btn" onClick={() => setShowFromSettings(false)} title="Bağla">
                            <i className="bi bi-x-lg" />
                        </button>
                    )}
                </div>

                <div className="net-overlay__tabs">
                    <button className={`net-overlay__tab ${activeTab === "status" ? "active" : ""}`} onClick={() => setActiveTab("status")}>
                        <i className="bi bi-wifi" /> Status
                    </button>
                    <button className={`net-overlay__tab ${activeTab === "ayarlar" ? "active" : ""}`} onClick={() => setActiveTab("ayarlar")}>
                        <i className="bi bi-gear" /> Ayarlar
                    </button>
                </div>

                {activeTab === "status" && (
                <div className="net-overlay__status-content">
                    <p className="net-overlay__hint">Ayarlar tabına keçərək Master IP qeyd edə və ya Avto qoşul istifadə edə bilərsiniz.</p>
                </div>
                )}

                {activeTab === "ayarlar" && (
                <div className="net-overlay__settings">
                    <div className="net-overlay__settings-body">
                        <div className="net-overlay__setting-row">
                            <label className="net-overlay__label">Statik Master IP</label>
                            <input
                                type="text"
                                className="net-overlay__input"
                                placeholder="192.168.1.10"
                                value={staticIpInput}
                                onChange={(e) => setStaticIpInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                            />
                        </div>

                        <div className="net-overlay__btn-row">
                            <button
                                className="net-overlay__btn net-overlay__btn-scan"
                                onClick={handleAutoScan}
                                disabled={isScanning}
                                title="Avtomatik axtar"
                            >
                                {isScanning ? <span className="net-overlay__spinner" /> : <i className="bi bi-search" />}
                                {isScanning ? "Axtarılır..." : "Axtar"}
                            </button>
                            <button
                                className="net-overlay__btn net-overlay__btn-connect"
                                onClick={handleConnect}
                                disabled={isReconnecting || !staticIpInput.trim()}
                                title="Statik IP ilə qoşul"
                            >
                                {isReconnecting ? <span className="net-overlay__spinner" /> : <i className="bi bi-plug" />}
                                {isReconnecting ? "Qoşulur..." : "Qoşul"}
                            </button>
                        </div>

                        <button
                            className="net-overlay__btn net-overlay__btn-primary"
                            onClick={handleAutoScan}
                            disabled={isScanning}
                            title="Avtomatik axtar və qoşul"
                        >
                            {isScanning ? <span className="net-overlay__spinner" /> : <i className="bi bi-wifi" />}
                            {isScanning ? "Axtarılır..." : "Avto qoşul"}
                        </button>
                    </div>
                </div>
                )}

                <div className="net-overlay__footer">
                    <div className="net-overlay__ips">
                        <span>Master: <strong>{masterIp || "—"}</strong></span>
                        <span>Sizin IP: <strong>{slaveIp || "—"}</strong></span>
                    </div>
                    <p className="net-overlay__hint">Ping işləyirsə, Statik IP yazıb Qoşul basın</p>
                </div>

                <button className="net-overlay__exit" onClick={() => {
                    if (window.electronAPI?.quitApp) window.electronAPI.quitApp();
                    else if (window.electronAPI) window.close();
                    else navigate('/');
                }}>
                    <i className="bi bi-box-arrow-right" /> Sistemdən çıx
                </button>
            </div>
        </div>
    );
};

export default NetworkOverlay;

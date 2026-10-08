import React, { useEffect, useState, useRef } from "react";
import { Modal } from "react-bootstrap";
import apiConfig, { getSocket, initNetwork } from "../../utils/apiConfig";
import { checkIsSlaveTerminal } from "../../utils/masterSlaveHelpers";
import { useNavigate } from "react-router-dom";
import { t } from "../../utils/translations";
import "../DiscountModal/DiscountModal.css";
import "./NetworkOverlay.css";

const NetworkOverlay = () => {
    const navigate = useNavigate();
    const [isDisconnected, setIsDisconnected] = useState(false);
    /** Ayrı modal: Master IP formu (Kontrol panel və ya “Statik IP” düyməsi) */
    const [showIpConfigModal, setShowIpConfigModal] = useState(false);
    const wifiTapCountRef = useRef(0);
    const wifiTapTimerRef = useRef(null);
    const [masterIp, setMasterIp] = useState(null);
    const [slaveIp, setSlaveIp] = useState(null);
    const [staticIpInput, setStaticIpInput] = useState("");
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const hasAutoScanned = useRef(false);

    useEffect(() => {
        let pollingInterval;
        let registeredSocket = null;
        // Anlıq/keçici kəsilmələr (bir neçə saniyəlik Wi-Fi fasiləsi, socket-in yenidən
        // qoşulması zamanı yaranan təbii gecikmə) tam ekranı bloklamasın — yalnız
        // DISCONNECT_GRACE_MS müddətindən çox davam edən həqiqi kəsilmədə göstərilsin.
        const DISCONNECT_GRACE_MS = 4000;
        let disconnectTimer = null;

        const clearDisconnectTimer = () => {
            if (disconnectTimer) {
                clearTimeout(disconnectTimer);
                disconnectTimer = null;
            }
        };
        const markConnected = () => {
            clearDisconnectTimer();
            setIsDisconnected(false);
        };
        const scheduleDisconnect = () => {
            if (disconnectTimer) return;
            disconnectTimer = setTimeout(() => {
                disconnectTimer = null;
                setIsDisconnected(true);
            }, DISCONNECT_GRACE_MS);
        };

        const onDisconnect = () => scheduleDisconnect();
        const onConnect = () => markConnected();

        const poll = () => {
            if (!checkIsSlaveTerminal()) {
                clearDisconnectTimer();
                setIsDisconnected(false);
                return;
            }
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
            if (socket && socket.connected) {
                markConnected();
            } else {
                scheduleDisconnect();
            }
        };

        poll();
        pollingInterval = setInterval(poll, 5000);

        if (window.electronAPI?.getLocalIp) {
            window.electronAPI.getLocalIp().then(setSlaveIp).catch(() => {});
        } else {
            const h = window.location.hostname;
            if (h && h !== "localhost" && h !== "127.0.0.1") setSlaveIp(h);
        }

        return () => {
            clearInterval(pollingInterval);
            clearDisconnectTimer();
            if (registeredSocket) {
                registeredSocket.off("disconnect", onDisconnect);
                registeredSocket.off("connect", onConnect);
            }
        };
    }, []);

    const isSlaveTerminal = checkIsSlaveTerminal();
    // Yenilənmə pəncərəsi açıq olduğu müddətdə arxa fondakı "əlaqə yoxdur" ekranı gizlənsin
    const overlayActive = isSlaveTerminal && !isManualRefreshing && (isDisconnected || showIpConfigModal);

    useEffect(() => {
        if (!isSlaveTerminal) setShowIpConfigModal(false);
    }, [isSlaveTerminal]);

    useEffect(() => {
        if (!showIpConfigModal) hasAutoScanned.current = false;
    }, [showIpConfigModal]);

    useEffect(() => {
        if ((isDisconnected || showIpConfigModal) && window.electronAPI?.getStaticMasterIp) {
            window.electronAPI.getStaticMasterIp().then((ip) => setStaticIpInput(ip || "")).catch(() => {});
        }
    }, [isDisconnected, showIpConfigModal]);

    useEffect(() => {
        const handler = () => {
            if (checkIsSlaveTerminal()) setShowIpConfigModal(true);
        };
        window.addEventListener("openMasterSlaveSettings", handler);
        return () => window.removeEventListener("openMasterSlaveSettings", handler);
    }, []);

    useEffect(() => {
        return () => {
            if (wifiTapTimerRef.current) clearTimeout(wifiTapTimerRef.current);
        };
    }, []);

    const socket = getSocket();
    const socketConnected = !!(socket && socket.connected);

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



    const handleConnect = async () => {
        const ip = staticIpInput.trim();
        if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return;
        setIsReconnecting(true);
        try {
            if (window.electronAPI?.setStaticMasterIp) {
                await window.electronAPI.setStaticMasterIp(ip);
            }
            await initNetwork(false, false, ip);
            window.location.reload();
        } catch (e) {
            console.error("Reconnect error:", e);
        } finally {
            setIsReconnecting(false);
        }
    };

    const canQuit = !!window.electronAPI?.quitApp;

    const handleQuit = () => {
        if (window.electronAPI?.quitApp) {
            try { window.electronAPI.quitApp(); } catch (e) { console.warn("quitApp error:", e); }
        }
        if (window.close) window.close();
        setTimeout(() => { navigate("/"); }, 300);
    };

    const hasRefreshWindowApi = typeof window !== "undefined" && !!window.electronAPI?.openRefreshWindow;

    // Slave əlaqəsi "kəsilib" göstərildikdə də Master-dəki kimi "Məlumatların yenilənməsi"
    // pəncərəsini göstərmək üçün — real sinxronizasiya uğursuz olsa belə pəncərə açılıb bağlanmalıdır
    const handleManualRefresh = async () => {
        if (isManualRefreshing || !hasRefreshWindowApi) return;
        setIsManualRefreshing(true);
        let profileId = null;
        try {
            const authResult = JSON.parse(localStorage.getItem("authResult") || "{}");
            profileId = authResult?.data?.profile?.id || null;
        } catch (e) {}

        window.electronAPI.openRefreshWindow();
        window.electronAPI.sendRefreshSyncEvent({ type: "start", isOnline: navigator.onLine });

        try {
            // Qısa timeout: bu düymə əlaqə olmayanda da göstərilir — əsl sinxronizasiyanın
            // uğurlu olması vacib deyil, sadəcə pəncərə tez açılıb bağlanmalı və düymə
            // "asılı" qalmadan növbəti klikə hazır olmalıdır.
            const syncRes = profileId
                ? await apiConfig.post(`/sync/refresh/${profileId}`, {}, { timeout: 6000 }).catch(() => null)
                : null;
            const counts = syncRes?.data?.counts || {};
            window.electronAPI.sendRefreshSyncEvent({
                type: "done",
                counts,
                deltas: {},
                isOnline: syncRes?.data?.isOnline !== false,
            });
        } catch (e) {
            window.electronAPI.sendRefreshSyncEvent({ type: "done", counts: {}, deltas: {}, isOnline: false });
        } finally {
            setIsManualRefreshing(false);
        }
    };

    const handleWifiIconTap = () => {
        if (wifiTapTimerRef.current) clearTimeout(wifiTapTimerRef.current);
        wifiTapCountRef.current += 1;
        if (wifiTapCountRef.current >= 5) {
            wifiTapCountRef.current = 0;
            setShowIpConfigModal(true);
        }
        wifiTapTimerRef.current = setTimeout(() => {
            wifiTapCountRef.current = 0;
            wifiTapTimerRef.current = null;
        }, 800);
    };

    const masterDisplay = masterIp || (staticIpInput.trim() || "—");
    const networkOk = socketConnected && !isDisconnected;

    if (!isSlaveTerminal) return null;

    return (
        <>
            {/* 1) Master qopdu — şəffaf ekran, yalnız "Proqramı bağla" düyməsi; WiFi ikonuna 5 vuranda IP modal açılır */}
            {isDisconnected && !showIpConfigModal && (
                <Modal
                    show
                    fullscreen
                    animation={false}
                    backdrop="static"
                    keyboard={false}
                    className="network-master-modal-root network-master-modal--disconnect"
                    dialogClassName="network-master-dialog network-master-dialog--fullscreen"
                    contentClassName="network-master-modal-content-fullscreen network-master-modal-content--disconnect"
                    backdropClassName="network-master-modal-backdrop network-master-disconnect-backdrop"
                >
                    <div className="network-disconnect-overlay">
                        <button
                            type="button"
                            className="network-disconnect-wifi-trigger"
                            onClick={handleWifiIconTap}
                            aria-label="WiFi ayarları"
                            title=""
                        >
                            <i className="bi bi-wifi-off" />
                        </button>
                        <div className="network-disconnect-inner">
                            <div className="network-disconnect-icon-wrap">
                                <i className="bi bi-wifi-off" aria-hidden />
                            </div>
                            <h2 className="network-disconnect-title">{t("esas_terminala_qosulu_deyil")}</h2>
                            <p className="network-disconnect-lead">{t("sebeke_elcatan_deyil")}</p>
                            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                                {hasRefreshWindowApi && (
                                    <button
                                        type="button"
                                        className="network-disconnect-quit-btn"
                                        onClick={handleManualRefresh}
                                        disabled={isManualRefreshing}
                                        style={{ background: "#053796" }}
                                    >
                                        <i className="bi bi-arrow-repeat" aria-hidden />
                                        <span>{t("refresh")}</span>
                                    </button>
                                )}
                                {canQuit && (
                                    <button type="button" className="network-disconnect-quit-btn" onClick={handleQuit}>
                                        <i className="bi bi-x-lg" aria-hidden />
                                        <span>{t("proqrami_bagla")}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* 2) Master IP — ayrı mərkəzi modal (endirim modalı ölçüsü / davranışı) */}
            {showIpConfigModal && (
                <Modal
                    show
                    onHide={() => setShowIpConfigModal(false)}
                    centered
                    animation={false}
                    backdrop
                    keyboard
                    className="network-master-modal-root network-master-modal--ipconfig"
                    dialogClassName="custom-modal-width network-master-dialog network-master-ip-dialog"
                    contentClassName="custom-modal-content"
                    backdropClassName="network-master-modal-backdrop network-master-ip-modal-backdrop"
                >
                    <div className="discount-modal-container network-master-ip-modal-inner">
                        <div className="discount-header network-master-fs-header network-master-settings-header">
                            <div className="header-left">
                                <div className="header-icon">
                                    <i className={`bi network-master-header-wifi-ic ${networkOk ? "bi-wifi" : "bi-wifi-off"}`} aria-hidden />
                                </div>
                                <span className="header-title">{t("master_ip_ayarlari")}</span>
                            </div>
                            <button type="button" className="close-btn" onClick={() => setShowIpConfigModal(false)} title={t("bagla")}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="discount-body network-master-ip-modal-body">
                            <div className={`network-master-status-card ${networkOk ? "network-master-status-card--ok" : "network-master-status-card--bad"}`}>
                                <div className="network-master-status-row network-master-status-row--head">
                                    <span className="network-master-status-label">{t("socket_elaqesi")}</span>
                                    <span className={`network-master-badge ${networkOk ? "network-master-badge--ok" : "network-master-badge--bad"}`}>
                                        {networkOk ? "Qoşulub" : "Kəsilib"}
                                    </span>
                                </div>
                                <div className="network-master-status-row">
                                    <span className="network-master-status-label">Master server</span>
                                    <strong className="network-master-status-mono">{masterDisplay}</strong>
                                </div>
                                <div className="network-master-status-row">
                                    <span className="network-master-status-label">Bu terminal (lokal IP)</span>
                                    <strong className="network-master-status-mono">{slaveIp || "—"}</strong>
                                </div>
                            </div>

                            <p className="network-master-fs-hint">{t("statik_ip_yazin")}<strong>{t("qosul")}</strong>, <strong>Axtar</strong>{t("ve_ya")}<strong>{t("avto_qosul")}</strong>{t("ile_master_tapin")}</p>

                            <label className="network-master-field-label" htmlFor="network-master-ip-field">
                                Statik Master IP
                            </label>
                            <input
                                id="network-master-ip-field"
                                type="text"
                                className="discount-input network-master-ip-input"
                                placeholder="192.168.1.10"
                                value={staticIpInput}
                                onChange={(e) => setStaticIpInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                            />

                            <div className="network-master-btn-grid-3">
                                <button type="button" className="network-master-chip-btn network-master-chip-btn--outline" onClick={handleAutoScan} disabled={isScanning}>
                                    {isScanning ? <span className="network-master-btn-spinner network-master-btn-spinner--dark" /> : <i className="bi bi-search" />}
                                    <span>{isScanning ? "..." : "Axtar"}</span>
                                </button>
                                <button
                                    type="button"
                                    className="network-master-chip-btn network-master-chip-btn--primary"
                                    onClick={handleConnect}
                                    disabled={isReconnecting || !staticIpInput.trim()}
                                >
                                    {isReconnecting ? <span className="network-master-btn-spinner" /> : <i className="bi bi-plug" />}
                                    <span>{isReconnecting ? "..." : "Qoşul"}</span>
                                </button>
                                <button type="button" className="network-master-chip-btn network-master-chip-btn--primary" onClick={handleAutoScan} disabled={isScanning}>
                                    {isScanning ? <span className="network-master-btn-spinner" /> : <i className="bi bi-wifi" />}
                                    <span>{isScanning ? "..." : "Avto qoşul"}</span>
                                </button>
                            </div>

                            {canQuit && (
                                <div className="network-master-exit-row">
                                    <button type="button" className="network-master-chip-btn network-master-chip-btn--outline network-master-exit-btn" onClick={handleQuit}>
                                        <i className="bi bi-x-lg" aria-hidden />
                                        <span>{t("proqrami_bagla")}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default NetworkOverlay;

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Modal, ProgressBar } from "react-bootstrap";
import { useSelector } from "react-redux";
import axios, { localApi } from "../../utils/apiConfig";
import './StatusModal.css';
import { toast } from 'sonner';
import { usePrinterDiagnostics } from "../../hooks/usePrinterDiagnostics";
import {
    getPrinterDiagnosticClass,
    getPrinterDiagnosticLabel,
    getPrinterKey,
} from "../../utils/printerDiagnostics";
import { t } from "../../utils/translations";

const StatusModal = ({ show, onHide }) => {
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const { isSocketConnected, hasInternet } = useSelector((state) => state.SyncSlice);
    const [localIp, setLocalIp] = useState("...");
    const [memoryUsage, setMemoryUsage] = useState({ used: 0, total: 128 });
    const [diskUsage, setDiskUsage] = useState({ used: 0, total: 0 });
    const [syncStatus, setSyncStatus] = useState({ isSyncing: false, pendingCount: 0 });
    const [networkStatus, setNetworkStatus] = useState({
        modem: true,
        internet: true,
        ws: true,
        syncer: true,
        pos: true
    });
    const [printers, setPrinters] = useState([]);
    const [registers, setRegisters] = useState([]);
    const [appVersion, setAppVersion] = useState(null);
    const [pendingDetails, setPendingDetails] = useState(null);
    const [showPendingDetails, setShowPendingDetails] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    /** Gözləyən sifarişlər modalı — sinxro animasiya / sayğac */
    const [pomSnapshotOrders, setPomSnapshotOrders] = useState([]);
    const [pomHiddenUuids, setPomHiddenUuids] = useState([]);
    const [pomExitingUuids, setPomExitingUuids] = useState([]);
    const [pomSyncActive, setPomSyncActive] = useState(false);
    const [pomSyncSeconds, setPomSyncSeconds] = useState(0);
    const [pomSyncPhase, setPomSyncPhase] = useState("idle");
    const pomSecIntervalRef = useRef(null);
    const pomPollTimeoutRef = useRef(null);
    const lastApiUuidsRef = useRef(null);
    const pomPollAttemptsRef = useRef(0);
    const pomPollCancelledRef = useRef(false);
    const pomSuccessScheduledRef = useRef(false);
    const {
        diagnostics: printerDiagnostics,
        isChecking: printerDiagnosticsChecking,
        refresh: refreshPrinterDiagnostics,
    } = usePrinterDiagnostics(printers, {
        enabled: show && printers.length > 0,
        intervalMs: 15000,
        timeoutMs: 3500,
    });

    const profile = loginedProfileData?.data?.profile || {};
    const terminal = loginedProfileData?.data?.terminal || {};

    const isMasterSlaveActive = terminal.is_master_slave_active === 1 || profile.is_master_slave_active === 1;
    const isMaster = terminal.is_master === 1 || profile.is_master === 1;

    // Fetch Printers
    const fetchPrinters = async () => {
        try {
            const profileId = loginedProfileData?.data?.profile?.id;
            if (!profileId) return;

            const response = await axios.get(`/pos/printers/${profileId}`);
            if (response.data && Array.isArray(response.data.data)) {
                setPrinters(response.data.data.map(p => ({
                    id: p.id,
                    local_name: p.local_name,
                    name: p.local_name || p.name,
                    code: p.name,
                    status: "checking",
                    ip: p.ip || "",
                    port: p.port,
                    connection_type: p.connection_type,
                    usb_name: p.usb_name,
                    is_cashier: p.is_cashier,
                    type: p.type,
                    departments: [
                        p.is_cashier === 1 ? "Çek" : null,
                        p.type?.includes("Bar") ? "Bar" : null,
                        p.type?.includes("Kitchen") || p.type?.includes("Mətbəx") ? "Mətbəx" : null,
                        p.type?.includes("Manqal") ? "Manqal" : null
                    ].filter(Boolean)
                })));
            }
        } catch (error) {
            console.error("Error fetching printers for status modal:", error);
        }
    };

    useEffect(() => {
        if (!show) return;

        // Fetch Local IP
        if (window.electronAPI && window.electronAPI.getLocalIp) {
            window.electronAPI.getLocalIp().then(setLocalIp).catch(console.error);
        }

        // Fetch App Version
        if (window.electronAPI?.getAppVersion) {
            window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
        }

        // Mock Memory Usage (Actually fetching this might require electron API, but for demo let's use static/randomized)
        // Or if electronAPI has getMemoryInfo
        if (window.electronAPI && window.electronAPI.getMemoryInfo) {
            window.electronAPI.getMemoryInfo().then(info => {
                setMemoryUsage({
                    used: info.used,
                    total: info.total
                });
            });
        } else {
            setMemoryUsage({ used: 45.2, total: 128 });
        }

        // Fetch Disk Info
        if (window.electronAPI && window.electronAPI.getDiskInfo) {
            window.electronAPI.getDiskInfo().then(setDiskUsage).catch(console.error);
        }

        // Check Connectivity
        const updateConnectivity = () => {
            setNetworkStatus(prev => ({ ...prev, modem: navigator.onLine }));
            if (window.electronAPI && window.electronAPI.checkInternet) {
                window.electronAPI.checkInternet().then(status => {
                    setNetworkStatus(prev => ({ ...prev, internet: status }));
                }).catch(() => {
                    setNetworkStatus(prev => ({ ...prev, internet: false }));
                });
            }
        };
        window.addEventListener('online', updateConnectivity);
        window.addEventListener('offline', updateConnectivity);
        updateConnectivity();
        const connInterval = setInterval(updateConnectivity, 6000);

        // Fetch Sync Status
        const fetchSyncStatus = () => {
            if (window.electronAPI && window.electronAPI.getSyncStatus) {
                window.electronAPI.getSyncStatus().then(setSyncStatus).catch(console.error);
            }
        };
        fetchSyncStatus();
        const syncInterval = setInterval(fetchSyncStatus, 6000); // Check every 5s when open

        fetchPrinters();

        return () => {
            window.removeEventListener('online', updateConnectivity);
            window.removeEventListener('offline', updateConnectivity);
            clearInterval(syncInterval);
            clearInterval(connInterval);
        };
    }, [show, loginedProfileData]); // Added loginedProfileData to dependencies for fetchPrinters

    const clearPomTimers = useCallback(() => {
        if (pomSecIntervalRef.current) {
            clearInterval(pomSecIntervalRef.current);
            pomSecIntervalRef.current = null;
        }
        if (pomPollTimeoutRef.current) {
            clearTimeout(pomPollTimeoutRef.current);
            pomPollTimeoutRef.current = null;
        }
    }, []);

    const resetPomSyncUi = useCallback(() => {
        pomPollCancelledRef.current = true;
        pomSuccessScheduledRef.current = false;
        clearPomTimers();
        setPomSnapshotOrders([]);
        setPomHiddenUuids([]);
        setPomExitingUuids([]);
        setPomSyncActive(false);
        setPomSyncSeconds(0);
        setPomSyncPhase("idle");
        lastApiUuidsRef.current = null;
        pomPollAttemptsRef.current = 0;
        setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
    }, [clearPomTimers]);

    useEffect(() => {
        if (!showPendingDetails) {
            resetPomSyncUi();
        }
    }, [showPendingDetails, resetPomSyncUi]);

    useEffect(() => {
        if (pomExitingUuids.length === 0) return undefined;
        const t = setTimeout(() => {
            setPomHiddenUuids((h) => [...new Set([...h, ...pomExitingUuids])]);
            setPomExitingUuids([]);
        }, 480);
        return () => clearTimeout(t);
    }, [pomExitingUuids.join("|")]);

    const handleQuickSync = async () => {
        setSyncStatus(prev => ({ ...prev, isSyncing: true }));
        try {
            await localApi.post("/sync/force-now");
            setTimeout(() => {
                if (window.electronAPI?.getSyncStatus) {
                    window.electronAPI.getSyncStatus().then(setSyncStatus).catch(() => {});
                }
            }, 3000);
            toast.success(t("sinxronizasiya_basladildi"));
        } catch (error) {
            console.error("Manual sync error:", error);
            toast.error(t("sinxronizasiya_xetasi"));
        } finally {
            setSyncStatus(prev => ({ ...prev, isSyncing: false }));
        }
    };

    const finishPendingModalSuccess = useCallback(() => {
        pomPollCancelledRef.current = true;
        clearPomTimers();
        setPomSyncActive(false);
        setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
        if (window.electronAPI?.getSyncStatus) {
            window.electronAPI.getSyncStatus().then(setSyncStatus).catch(() => {});
        }
        setPomSyncPhase("success");
        toast.success(t("sinxronizasiya_tamamlandi"));
        setTimeout(() => {
            setShowPendingDetails(false);
            setPendingDetails(null);
            resetPomSyncUi();
        }, 1600);
    }, [clearPomTimers, resetPomSyncUi]);

    const handlePendingModalSync = async () => {
        if (!pendingDetails?.orders?.length) return;
        pomPollCancelledRef.current = false;
        pomSuccessScheduledRef.current = false;
        clearPomTimers();
        setPomHiddenUuids([]);
        setPomExitingUuids([]);
        setPomSnapshotOrders(pendingDetails.orders.map((o) => ({ ...o })));
        lastApiUuidsRef.current = new Set(pendingDetails.orders.map((o) => o.uuid));
        pomPollAttemptsRef.current = 0;
        setPomSyncActive(true);
        setPomSyncPhase("running");
        setPomSyncSeconds(0);
        setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

        pomSecIntervalRef.current = setInterval(() => {
            setPomSyncSeconds((s) => s + 1);
        }, 1000);

        try {
            await localApi.post("/sync/force-now");
        } catch (error) {
            console.error("Manual sync error:", error);
            clearPomTimers();
            setPomSyncActive(false);
            setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
            setPomSnapshotOrders([]);
            toast.error(t("sinxronizasiya_xetasi"));
            return;
        }

        const maxAttempts = 50;
        const poll = async () => {
            if (pomPollCancelledRef.current) return;
            pomPollAttemptsRef.current += 1;
            try {
                const res = await localApi.get("/sync/pending-details");
                if (pomPollCancelledRef.current) return;
                setPendingDetails(res.data);
                const list = res.data.orders || [];
                const newIds = new Set(list.map((o) => o.uuid));
                const prev = lastApiUuidsRef.current;
                if (prev && prev.size > 0) {
                    const vanished = [...prev].filter((uuid) => !newIds.has(uuid));
                    if (vanished.length > 0) {
                        setPomExitingUuids((e) => {
                            const next = new Set([...e, ...vanished]);
                            return [...next];
                        });
                    }
                }
                lastApiUuidsRef.current = newIds;
                const cnt = res.data.count ?? list.length;
                if (cnt === 0 && !pomSuccessScheduledRef.current) {
                    pomSuccessScheduledRef.current = true;
                    pomPollCancelledRef.current = true;
                    clearPomTimers();
                    setTimeout(() => {
                        finishPendingModalSuccess();
                    }, 520);
                    return;
                }
            } catch {
                /* tək poll uğursuz — davam */
            }
            if (pomPollCancelledRef.current) return;
            if (pomPollAttemptsRef.current >= maxAttempts) {
                pomPollCancelledRef.current = true;
                pomSuccessScheduledRef.current = false;
                clearPomTimers();
                setPomSyncActive(false);
                setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
                setPomSnapshotOrders([]);
                toast.warning(t("muddet_bitdi_pending_qala_biler_bir_az_sonra_yeniden_cehd_edin"));
                return;
            }
            pomPollTimeoutRef.current = setTimeout(poll, 2000);
        };
        pomPollTimeoutRef.current = setTimeout(poll, 600);
    };

    const handleSync = async () => {
        if (showPendingDetails && pendingDetails?.orders?.length > 0) {
            await handlePendingModalSync();
            return;
        }
        await handleQuickSync();
    };

    const fetchPendingDetails = async () => {
        try {
            const res = await localApi.get("/sync/pending-details");
            setPendingDetails(res.data);
            setShowPendingDetails(true);
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || "Bilinməyən xəta";
            toast.error(`Pending məlumatları alınmadı: ${msg}`);
        }
    };

    const handleClearStuck = async () => {
        setIsClearing(true);
        try {
            const res = await localApi.post("/sync/clear-stuck", { olderThanMinutes: 30 });
            toast.success(res.data.message);
            setShowPendingDetails(false);
            setPendingDetails(null);
            if (window.electronAPI?.getSyncStatus) {
                window.electronAPI.getSyncStatus().then(setSyncStatus).catch(() => {});
            }
        } catch (e) {
            toast.error(t("temizleme_xetasi"));
        } finally {
            setIsClearing(false);
        }
    };

    const formatDate = (dateInput) => {
        if (!dateInput) return "04/09/2025";
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "04/09/2025";

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const apiOrderMap =
        pendingDetails?.orders?.length > 0
            ? Object.fromEntries(pendingDetails.orders.map((o) => [o.uuid, o]))
            : {};
    const pomRowsSource =
        pomSnapshotOrders.length > 0 ? pomSnapshotOrders : pendingDetails?.orders || [];
    const visiblePomRows = pomRowsSource.filter((o) => !pomHiddenUuids.includes(o.uuid));
    const pomFooterLocked = pomSyncActive || pomSyncPhase === "success";
    const pomCloseDisabled = pomSyncPhase === "success";
    const pomShowEmptyIdle =
        (!pendingDetails || pendingDetails.orders.length === 0) &&
        pomSnapshotOrders.length === 0 &&
        !pomSyncActive;

    return (
        <>
        <Modal
            show={show && !showPendingDetails}
            onHide={onHide}
            centered
            scrollable
            size="xl"
            className="status-modal"
            backdrop="static"
        >
            <div className="status-modal-content">
                <div className="status-modal-header">
                    <h5 className="modal-title">Status</h5>
                    <button className="close-btn" onClick={onHide}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                <div className="status-modal-body">
                    <div className="status-grid">
                        {/* Left Column */}
                        <div className="status-left">
                            {/* System Information */}
                            <div className="status-card system-info">
                                <div className="card-header">
                                    <i className="bi bi-activity icon-main"></i>
                                    <h6>System Information</h6>
                                </div>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="label">Brend:</span>
                                        <span className="value">{profile.restaurant_name || "RetailPro Systems"}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Filial:</span>
                                        <span className="value">{profile.branch_name || profile.name || "Main"}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">IP Adress:</span>
                                        <span className="value">{localIp}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">{t("tetbiq_versiyasi")}</span>
                                        <span className="value">{appVersion ? `v${appVersion}` : "..."}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Terminal:</span>
                                        <span className="value">{terminal.name || terminal.terminal_id || "POS-TERM-001"}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Rol:</span>
                                        <span className="value">
                                            {!isMasterSlaveActive
                                                ? "Tək Terminal"
                                                : isMaster
                                                    ? "MASTER (Ana Terminal)"
                                                    : "SLAVE (Köməkçi Terminal)"
                                            }
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Last sync</span>
                                        <span className="value">{formatDate(syncStatus.lastSyncTime || terminal.last_sync)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">{t("terminal_versiyasi")}</span>
                                        <span className="value">{appVersion ? `T${appVersion}` : (terminal.version || "...")}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Yaddaş istifadəsi (Disk C:) */}
                            <div className="status-card memory-usage">
                                <h6>{t("yaddas_istifadesi_c")}</h6>
                                <div className="memory-info">
                                    <span>{t("i̇stifade_olunan")}</span>
                                    <span>{diskUsage.used} GB / {diskUsage.total} GB</span>
                                </div>
                                <ProgressBar
                                    now={diskUsage.total > 0 ? (diskUsage.used / diskUsage.total) * 100 : 0}
                                    className="custom-progress"
                                />
                            </div>

                            {/* Şəbəkə statusu */}
                            <div className="status-card network-status">
                                <h6>{t("sebeke_statusu")}</h6>
                                <div className="status-list">
                                    <div className="status-row">
                                        <span className={`sys-status-dot ${networkStatus.modem ? 'green' : 'red'}`}></span>
                                        <span>Modem</span>
                                    </div>
                                    <div className="status-row">
                                        <span className={`sys-status-dot ${networkStatus.internet ? 'green' : 'red'}`}></span>
                                        <span>{t("i̇nternet")}</span>
                                    </div>
                                    <div className="status-row">
                                        <span className={`sys-status-dot ${!isMasterSlaveActive || isSocketConnected ? 'green' : 'red'}`}></span>
                                        <span>WS{!isMasterSlaveActive ? " (Tək)" : ""}</span>
                                    </div>
                                    <div className="status-row">
                                        <span className={`sys-status-dot ${syncStatus.isSyncing ? 'orange' : (syncStatus.pendingCount > 0 ? 'red' : 'green')}`}></span>
                                        <span>Syncer - {syncStatus.pendingCount > 0 ? `${syncStatus.pendingCount} pending` : 'Synced'}</span>
                                        {syncStatus.pendingCount > 0 && (
                                            <button className="pending-view-btn" onClick={fetchPendingDetails}>
                                                <i className="bi bi-eye-fill" />
                                                Bax
                                            </button>
                                        )}
                                    </div>
                                    {syncStatus.lastSyncError ? (
                                        <div className="sync-last-error-hint" title={syncStatus.lastSyncError}>
                                            <div className="sync-last-error-title">{t("son_avtosync_xetasi")}</div>
                                            <div className="sync-last-error-meta">
                                                {syncStatus.lastSyncErrorAt
                                                    ? formatDate(syncStatus.lastSyncErrorAt)
                                                    : "—"}
                                                {syncStatus.lastSyncErrorOrderPrefix
                                                    ? ` · sifariş ${syncStatus.lastSyncErrorOrderPrefix}…`
                                                    : ""}
                                            </div>
                                            <div className="sync-last-error-text">{syncStatus.lastSyncError}</div>
                                        </div>
                                    ) : null}

                                    <div className="status-row">
                                        <span className={`sys-status-dot ${hasInternet ? 'green' : 'red'}`}></span>
                                        <span>POS</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="status-right">
                            <div className="status-card devices-card">
                                <div className="card-header">
                                    <i className="bi bi-database icon-main"></i>
                                    <h6>{t("qosulu_cihazlar")}</h6>
                                </div>

                                <div className="devices-items-container full-width">
                                    {printers.map(device => {
                                        const diagnostic = printerDiagnostics[getPrinterKey(device)];
                                        const statusClass = printerDiagnosticsChecking && !diagnostic ? "checking" : getPrinterDiagnosticClass(diagnostic);
                                        const statusLabel = printerDiagnosticsChecking && !diagnostic ? "Yoxlanır" : getPrinterDiagnosticLabel(diagnostic);
                                        const queuedText = diagnostic?.queuedJobs > 0 ? ` • Növbə: ${diagnostic.queuedJobs}` : "";
                                        return (
                                        <div key={`printer-${device.id}`} className="device-detail-card">
                                            <div className="device-icon-side">
                                                <i className="bi bi-printer"></i>
                                            </div>
                                            <div className="device-info-side">
                                                <div className="device-card-top">
                                                    <div className="device-name-container">
                                                        <span className={`status-indicator status-indicator--${statusClass}`}></span>
                                                        <span className="device-display-name">{device.name}</span>
                                                    </div>
                                                    <i
                                                        className="bi bi-arrow-repeat device-sync-icon"
                                                        title={t("printer_statusunu_yenile")}
                                                        onClick={refreshPrinterDiagnostics}
                                                    ></i>
                                                </div>
                                                <div className="device-code">
                                                    {device.code}
                                                    {diagnostic?.detail ? ` • ${diagnostic.detail}` : ""}
                                                    {queuedText}
                                                </div>
                                                <div className="device-badges">
                                                    <span className={`dept-badge printer-diag-badge printer-diag-badge--${statusClass}`}>
                                                        {statusLabel}
                                                    </span>
                                                    {device.departments.map((dept, idx) => (
                                                        <span key={idx} className="dept-badge">{dept}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}

                                    {printers.length === 0 && (
                                        <div className="no-devices">{t("printer_tapilmadi")}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </Modal>

        {/* Pending Orders — ayrıca modal, status modal bağlanır */}
        <Modal
            show={showPendingDetails}
            onHide={() => setShowPendingDetails(false)}
            centered
            className="pending-orders-modal"
            backdrop="static"
            animation={false}
        >
            <div
                className={`pom-content${pomSyncPhase === "success" ? " pom-content--success-simple" : ""}`}
            >
                {pomSyncPhase === "success" ? (
                    <div className="pom-success-simple">
                        <i className="bi bi-check-circle-fill pom-success-simple-icon" aria-hidden="true" />
                        <p className="pom-success-simple-title">{t("ugurla_sinxronlasdi")}</p>
                        <p className="pom-success-simple-hint">{t("baglanir…")}</p>
                    </div>
                ) : (
                    <>
                {/* Header */}
                <div className="pom-header">
                    <div className="pom-header-left">
                        <div className="pom-icon">
                            <i className="bi bi-clock-history" />
                        </div>
                        <span className="pom-title">{t("gozleyen_sifarisler")}</span>
                        <span className="pom-badge-count">{pendingDetails?.count ?? visiblePomRows.length}</span>
                    </div>
                    <button
                        type="button"
                        className="pom-close"
                        onClick={() => setShowPendingDetails(false)}
                        disabled={pomCloseDisabled}
                        title={pomCloseDisabled ? "Bağlanır…" : "Bağla"}
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                </div>

                {/* Body */}
                <div className="pom-body">
                    {pomSyncPhase === "running" && pomSyncActive ? (
                        <div className="pom-sync-progress">
                            <div className="pom-sync-progress-inner">
                                <span className="pom-sync-spinner" aria-hidden="true" />
                                <span className="pom-sync-progress-text">
                                    Sinxronizasiya gedir… <strong>{pomSyncSeconds}s</strong>
                                </span>
                            </div>
                        </div>
                    ) : null}
                    {pomShowEmptyIdle ? (
                        <div className="pom-empty">
                            <i className="bi bi-check-circle-fill" />
                            <span>{t("gozleyen_sifaris_yoxdur")}</span>
                        </div>
                    ) : visiblePomRows.length === 0 && pomSyncActive && pomSyncPhase === "running" ? (
                        <div className="pom-empty pom-empty-wait">
                            <span className="pom-sync-spinner pom-sync-spinner-lg" aria-hidden="true" />
                            <span>{t("setirler_yenilenir…")}</span>
                        </div>
                    ) : (
                        visiblePomRows.map((o) => {
                            const merged = { ...o, ...(apiOrderMap[o.uuid] || {}) };
                            const rawDate = merged.updated_at || merged.created_at;
                            let timeStr = "—";
                            if (rawDate) {
                                const d = new Date(rawDate);
                                if (!isNaN(d.getTime())) {
                                    timeStr = d.toLocaleString("az-AZ", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        day: "2-digit",
                                        month: "2-digit",
                                    });
                                }
                            }
                            const exiting = pomExitingUuids.includes(merged.uuid);
                            return (
                                <div
                                    key={merged.uuid}
                                    className={`pom-row ${merged.is_deleted ? "deleted" : ""} ${exiting ? "pom-row-exit" : ""}`}
                                >
                                    <div className="pom-row-main">
                                        <div className="pom-uuid">
                                            <i className="bi bi-receipt" />
                                            {merged.uuid?.slice(0, 8)}…
                                        </div>
                                        <div className="pom-info">
                                            <span className="pom-table">{merged.table_name || "Masa yoxdur"}</span>
                                            <span className="pom-items">{merged.item_count} məhsul</span>
                                        </div>
                                    </div>
                                    <div className="pom-row-side">
                                        {merged.is_deleted && (
                                            <span className="pom-tag red">
                                                <i className="bi bi-trash3" /> Silinib
                                            </span>
                                        )}
                                        {merged.is_synced === 2 && (
                                            <span className="pom-tag orange">
                                                <i className="bi bi-exclamation-circle" />{t("buraxilib")}</span>
                                        )}
                                        {!merged.is_deleted && merged.is_synced !== 2 && (
                                            <span className="pom-tag blue">
                                                <i className="bi bi-hourglass-split" />{t("gozleyir")}</span>
                                        )}
                                        <span className="pom-time">{timeStr}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="pom-footer">
                    <button
                        type="button"
                        className="pom-btn cancel"
                        onClick={() => setShowPendingDetails(false)}
                        disabled={pomCloseDisabled}
                    >{t("bagla")}</button>
                    <div className="pom-footer-right">
                        <button
                            type="button"
                            className="pom-btn danger"
                            onClick={handleClearStuck}
                            disabled={isClearing || pomFooterLocked}
                        >
                            <i className="bi bi-trash3" />
                            {isClearing ? "Silinir..." : "Köhnəni Sil"}
                        </button>
                        <button
                            type="button"
                            className="pom-btn primary"
                            onClick={handleSync}
                            disabled={pomFooterLocked || syncStatus.isSyncing}
                        >
                            <i className={`bi bi-arrow-repeat ${pomSyncActive || syncStatus.isSyncing ? "spin" : ""}`} />
                            {pomSyncActive || syncStatus.isSyncing ? "Sinxronizasiya..." : "Sinxronizasiya et"}
                        </button>
                    </div>
                </div>
                    </>
                )}
            </div>
        </Modal>
        </>
    );
};

export default StatusModal;

import React, { useEffect, useState } from "react";
import { Modal, ProgressBar } from "react-bootstrap";
import { useSelector } from "react-redux";
import axios from "../../utils/apiConfig";
import './StatusModal.css';
import { toast } from 'sonner';

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

    const profile = loginedProfileData?.data?.profile || {};
    const terminal = loginedProfileData?.data?.terminal || {};

    // Fetch Printers
    const fetchPrinters = async () => {
        try {
            const profileId = loginedProfileData?.data?.profile?.id;
            if (!profileId) return;

            const response = await axios.get(`/pos/printers/${profileId}`);
            if (response.data && Array.isArray(response.data.data)) {
                setPrinters(response.data.data.map(p => ({
                    id: p.id,
                    name: p.local_name || p.name,
                    code: p.name,
                    status: "Connected",
                    ip: p.ip || "Network Printer",
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
        const connInterval = setInterval(updateConnectivity, 5000);

        // Fetch Sync Status
        const fetchSyncStatus = () => {
            if (window.electronAPI && window.electronAPI.getSyncStatus) {
                window.electronAPI.getSyncStatus().then(setSyncStatus).catch(console.error);
            }
        };
        fetchSyncStatus();
        const syncInterval = setInterval(fetchSyncStatus, 5000); // Check every 5s when open

        fetchPrinters();

        return () => {
            window.removeEventListener('online', updateConnectivity);
            window.removeEventListener('offline', updateConnectivity);
            clearInterval(syncInterval);
            clearInterval(connInterval);
        };
    }, [show, loginedProfileData]); // Added loginedProfileData to dependencies for fetchPrinters

    const handleSync = async () => {
        setSyncStatus(prev => ({ ...prev, isSyncing: true }));
        try {
            const profileId = loginedProfileData?.data?.profile?.id;
            await axios.post("/sync", { profileId });
            await fetchPrinters();
            toast.success("Məlumatlar buludla sinxronizasiya olundu");
        } catch (error) {
            console.error("Manual sync error:", error);
            toast.error("Sinxronizasiya xətası");
        } finally {
            setSyncStatus(prev => ({ ...prev, isSyncing: false }));
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

    return (
        <Modal
            show={show}
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
                                        <span className="label">Tətbiq versiyası:</span>
                                        <span className="value">2.0.1</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Terminal:</span>
                                        <span className="value">{terminal.name || terminal.terminal_id || "POS-TERM-001"}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Rol:</span>
                                        <span className="value">
                                            {terminal.is_master === 1 ? "MASTER (Ana Terminal)" : "SLAVE (Köməkçi Terminal)"}
                                            {terminal.is_master === 1 && (
                                                <div style={{ fontSize: '0.8rem', color: '#718096', fontWeight: 'normal' }}>
                                                    {terminal.is_master_slave_active === 1 ? "Master-Slave: Aktiv" : "Master-Slave: Deaktiv"}
                                                </div>
                                            )}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Last sync</span>
                                        <span className="value">{formatDate(syncStatus.lastSyncTime || terminal.last_sync)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Terminal versiyası:</span>
                                        <span className="value">{terminal.version || "p2795"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Yaddaş istifadəsi (Disk C:) */}
                            <div className="status-card memory-usage">
                                <h6>Yaddaş istifadəsi (C:)</h6>
                                <div className="memory-info">
                                    <span>İstifadə olunan</span>
                                    <span>{diskUsage.used} GB / {diskUsage.total} GB</span>
                                </div>
                                <ProgressBar
                                    now={diskUsage.total > 0 ? (diskUsage.used / diskUsage.total) * 100 : 0}
                                    className="custom-progress"
                                />
                            </div>

                            {/* Şəbəkə statusu */}
                            <div className="status-card network-status">
                                <h6>Şəbəkə statusu</h6>
                                <div className="status-list">
                                    <div className="status-row">
                                        <span className={`sys-status-dot ${networkStatus.modem ? 'green' : 'red'}`}></span>
                                        <span>Modem</span>
                                    </div>
                                    <div className="status-row">
                                        <span className={`sys-status-dot ${networkStatus.internet ? 'green' : 'red'}`}></span>
                                        <span>İnternet</span>
                                    </div>
                                    <div className="status-row">
                                        <span className={`sys-status-dot ${isSocketConnected ? 'green' : 'red'}`}></span>
                                        <span>WS</span>
                                    </div>
                                    <div className="status-row">
                                        <span className={`sys-status-dot ${syncStatus.isSyncing ? 'orange' : (syncStatus.pendingCount > 0 ? 'red' : 'green')}`}></span>
                                        <span>Syncer - {syncStatus.pendingCount > 0 ? `${syncStatus.pendingCount} pending` : 'Synced'}</span>
                                    </div>
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
                                    <h6>Qoşulu Cihazlar</h6>
                                </div>

                                <div className="devices-items-container full-width">
                                    {printers.map(device => (
                                        <div key={`printer-${device.id}`} className="device-detail-card">
                                            <div className="device-icon-side">
                                                <i className="bi bi-printer"></i>
                                            </div>
                                            <div className="device-info-side">
                                                <div className="device-card-top">
                                                    <div className="device-name-container">
                                                        <span className="status-indicator"></span>
                                                        <span className="device-display-name">{device.name}</span>
                                                    </div>
                                                    <i className="bi bi-arrow-repeat device-sync-icon" onClick={handleSync}></i>
                                                </div>
                                                <div className="device-code">{device.code}</div>
                                                <div className="device-badges">
                                                    {device.departments.map((dept, idx) => (
                                                        <span key={idx} className="dept-badge">{dept}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {printers.length === 0 && (
                                        <div className="no-devices">Printer tapılmadı</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default StatusModal;

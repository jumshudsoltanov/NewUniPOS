import React, { useState, useEffect } from "react";
import "./NotificationSidebar.css";
import { getNotifications, markAllAsOld, clearNotifications } from "../../utils/notificationService";

const NotificationSidebarComponent = ({ show, onClose }) => {
    const [activeTab, setActiveTab] = useState("new"); // "new" or "old"
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const load = () => {
            setNotifications(getNotifications());
        };
        load();
        window.addEventListener("newNotification", load);
        return () => window.removeEventListener("newNotification", load);
    }, []);

    const filteredNotifs = notifications.filter(n => n.status === activeTab);

    if (!show) return null;

    const handleClose = () => {
        if (activeTab === "new" && filteredNotifs.length > 0) {
            markAllAsOld();
        }
        onClose();
    };

    const handleClearAll = () => {
        clearNotifications(activeTab);
    };

    return (
        <div className="notification-overlay" onClick={handleClose}>
            <div className="notification-container" onClick={(e) => e.stopPropagation()}>
                {/* Left thin sidebar icons - as requested to be restored */}
                <div className="notif-left-bar">
                    <div className="notif-icon-circle active">
                        <i className="bi bi-house-door"></i>
                    </div>
                    <div className="notif-icon-item"><i className="bi bi-qr-code-scan"></i></div>
                    <div className="notif-icon-item"><i className="bi bi-telephone"></i></div>
                    <div className="notif-icon-item"><i className="bi bi-bicycle"></i></div>
                    <div className="notif-icon-item"><i className="bi bi-truck"></i></div>
                    <div className="notif-icon-item"><i className="bi bi-exclamation-triangle"></i></div>
                    <div className="notif-icon-item"><i className="bi bi-clock"></i></div>
                    <div className="notif-icon-item"><i className="bi bi-info-circle"></i></div>
                </div>

                {/* Main Notification Panel */}
                <div className="notif-main-panel">
                    <div className="notif-header">
                        <div className="notif-header-left">
                            <span>Bildirişlər</span>
                        </div>
                        <button className="notif-close-btn" onClick={handleClose}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div className="notif-content-wrapper">
                        {/* Toggle Switch */}
                        <div className="notif-toggle-container">
                            <button
                                className={`notif-toggle-btn ${activeTab === "new" ? "active" : ""}`}
                                onClick={() => setActiveTab("new")}
                            >
                                Yeni
                            </button>
                            <button
                                className={`notif-toggle-btn ${activeTab === "old" ? "active" : ""}`}
                                onClick={() => setActiveTab("old")}
                            >
                                Köhnə
                            </button>
                        </div>

                        {filteredNotifs.length > 0 && (
                            <div className="notif-actions-bar">
                                <button className="notif-clear-text-btn" onClick={handleClearAll}>
                                    <i className="bi bi-trash3"></i> Hamısını təmizlə
                                </button>
                            </div>
                        )}

                        {/* Notification list */}
                        <div className="notif-list-container">
                            {filteredNotifs.length > 0 ? (
                                filteredNotifs.map(n => {
                                    const isError = n.title?.toLowerCase().includes("xəta");
                                    return (
                                        <div key={n.id} className={`notif-item card-style ${isError ? 'notif-error' : ''}`}>
                                            <div className="notif-card-main">
                                                <div className="notif-card-icon-col">
                                                    <div className={`notif-type-icon-circle ${isError ? 'error' : 'info'}`}>
                                                        <i className={`bi ${isError ? 'bi-exclamation-octagon-fill' : 'bi-info-circle-fill'}`}></i>
                                                    </div>
                                                </div>
                                                <div className="notif-card-content-col">
                                                    <div className="notif-item-header">
                                                        <span className="notif-item-title">{n.title}</span>
                                                        <span className="notif-item-time">{n.time}</span>
                                                    </div>
                                                    <div className="notif-item-body">
                                                        {n.message}
                                                    </div>
                                                    <div className="notif-item-meta">
                                                        <div className="notif-meta-row">
                                                            {n.orderId && (
                                                                <div className="meta-badge order">
                                                                    <i className="bi bi-receipt"></i>
                                                                    <span>#{n.orderId}</span>
                                                                </div>
                                                            )}
                                                            {n.printerName && (
                                                                <div className="meta-badge printer">
                                                                    <i className="bi bi-printer"></i>
                                                                    <span>{n.printerName}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {n.fullDate && <div className="notif-full-date">{n.fullDate}</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="notif-empty-state">
                                    <i className="bi bi-bell-slash notif-empty-state-large-icon"></i>
                                    <p>Hələ ki, bildiriş yoxdur</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationSidebarComponent;

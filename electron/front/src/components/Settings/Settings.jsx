import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReturnCheckModal from "../ReturnCheckModal/ReturnCheckModal";
import SupportModal from "../SupportModal/SupportModal";
import ReportModal from "../ReportModal/ReportModal";
import CustomersSourceModal from "../Customers-Modal/CustomersSourceModal";
import "./Settings.css";

const Settings = () => {
    const navigate = useNavigate();
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showCustomersModal, setShowCustomersModal] = useState(false);
    const [showClock, setShowClock] = useState(() => {
        return localStorage.getItem("showHeaderClock") === "true";
    });

    // Toggle clock visibility in header
    const handleClockToggle = () => {
        const newValue = !showClock;
        setShowClock(newValue);
        localStorage.setItem("showHeaderClock", newValue.toString());
        // Dispatch custom event for Header to listen
        window.dispatchEvent(new CustomEvent("clockToggle", { detail: newValue }));
    };

    // Toggle fullscreen via Electron API
    const handleFullscreenToggle = async () => {
        if (window.electronAPI?.toggleFullscreen) {
            await window.electronAPI.toggleFullscreen();
        } else {
            // Fallback for browser
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
    };

    // Open AnyDesk via Electron API
    const handleOpenAnyDesk = async () => {
        if (window.electronAPI?.openAnyDesk) {
            await window.electronAPI.openAnyDesk();
        } else {
            alert("AnyDesk yalnız Electron tətbiqində açıla bilər");
        }
    };

    const topMenuItems = [
        {
            id: "refund",
            label: "Geri qaytarılma",
            icon: <i className="bi bi-arrow-counterclockwise"></i>,
            onClick: () => setShowReturnModal(true),
        },
        {
            id: "report",
            label: "Hesabat yarat",
            icon: <i className="bi bi-file-earmark-text"></i>,
            onClick: () => setShowReportModal(true),
        },
        {
            id: "operation",
            label: "Əməliyyat əlavə et",
            icon: <i className="bi bi-plus-square"></i>,
            highlight: true,
        },
        {
            id: "customers",
            label: "Müştərilər",
            icon: <i className="bi bi-people"></i>,
            highlight: true,
            onClick: () => setShowCustomersModal(true),
        },
        {
            id: "archive",
            label: "Çek arxivi",
            icon: <i className="bi bi-archive"></i>,
            onClick: () => navigate("/checks"),
        },
        {
            id: "devices",
            label: "Cihazlar",
            icon: <i className="bi bi-laptop"></i>,
            highlight: true,
        },
    ];

    const bottomMenuItems = [
        {
            id: "refresh",
            label: "Yenilə",
            icon: <i className="bi bi-arrow-repeat"></i>,
            onClick: () => window.location.reload(),
        },
        {
            id: "sound",
            label: "Səs",
            icon: <i className="bi bi-volume-up"></i>,
        },
        {
            id: "clock",
            label: showClock ? "Saatı gizlət" : "Saatı göstər",
            icon: <i className="bi bi-clock"></i>,
            onClick: handleClockToggle,
        },
        {
            id: "fullscreen",
            label: "Pəncərə rejimi",
            icon: <i className="bi bi-arrows-fullscreen"></i>,
            onClick: handleFullscreenToggle,
        },
        {
            id: "support",
            label: "Dəstək",
            icon: <i className="bi bi-question-circle"></i>,
            onClick: () => setShowSupportModal(true),
        },
        {
            id: "anydesk",
            label: "AnyDesk",
            icon: <i className="bi bi-display"></i>,
            onClick: handleOpenAnyDesk,
        },
    ];

    return (
        <>
            <div className="settings-page">
                {/* Header */}
                <div className="settings-page-header">
                    <button className="settings-back-btn" onClick={() => navigate(-1)}>
                        <i className="bi bi-arrow-left"></i>
                    </button>
                    <h1 className="settings-page-title">Kontrol panel</h1>
                </div>

                {/* Content */}
                <div className="settings-page-content">
                    {/* Top Menu Grid */}
                    <div className="settings-grid settings-grid-top">
                        {topMenuItems.map((item) => (
                            <button
                                key={item.id}
                                className="settings-card"
                                onClick={item.onClick}
                            >
                                <span className={`settings-card-icon ${item.highlight ? "highlight" : ""}`}>
                                    {item.icon}
                                </span>
                                <span className="settings-card-label">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Bottom Menu Row */}
                    <div className="settings-grid settings-grid-bottom">
                        {bottomMenuItems.map((item) => (
                            <button
                                key={item.id}
                                className="settings-card"
                                onClick={item.onClick}
                            >
                                <span className="settings-card-icon">{item.icon}</span>
                                <span className="settings-card-label">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Return Check Modal */}
            <ReturnCheckModal
                show={showReturnModal}
                onClose={() => setShowReturnModal(false)}
            />

            {/* Support Modal */}
            <SupportModal
                isOpen={showSupportModal}
                onClose={() => setShowSupportModal(false)}
            />

            {/* Report Modal */}
            <ReportModal
                show={showReportModal}
                onClose={() => setShowReportModal(false)}
            />

            {/* Customers Source Modal */}
            <CustomersSourceModal
                show={showCustomersModal}
                onHide={() => setShowCustomersModal(false)}
            />
        </>
    );
};

export default Settings;

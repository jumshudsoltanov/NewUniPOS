import { useNavigate } from "react-router-dom";
import "./Settings.css";

const Settings = () => {
    const navigate = useNavigate();

    const topMenuItems = [
        {
            id: "refund",
            label: "Geri qaytarılma",
            icon: <i className="bi bi-arrow-counterclockwise"></i>,
        },
        {
            id: "report",
            label: "Hesabat yarat",
            icon: <i className="bi bi-file-earmark-text"></i>,
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
            label: "Saat",
            icon: <i className="bi bi-clock"></i>,
        },
        {
            id: "fullscreen",
            label: "Tam ekran et",
            icon: <i className="bi bi-arrows-fullscreen"></i>,
            onClick: () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            },
        },
        {
            id: "support",
            label: "Dəstək",
            icon: <i className="bi bi-question-circle"></i>,
        },
    ];

    return (
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
    );
};

export default Settings;

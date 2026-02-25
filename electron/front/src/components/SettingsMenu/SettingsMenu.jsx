import "./SettingsMenu.css";
import { useSelector } from "react-redux";

const SettingsMenu = ({ isOpen, onClose, onRefresh, onBrandList, onDownloadData, onExit, onQuitApp }) => {
    if (!isOpen) return null;

    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const isMaster = loginedProfileData?.data?.terminal?.is_master === 1;

    const handleOverlayClick = (e) => {
        if (e.target.classList.contains("settings-menu-overlay")) {
            onClose();
        }
    };

    const menuItems = [
        {
            id: "refresh",
            label: "Yenilə",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M22 12C22 17.52 17.52 22 12 22C6.48 22 3.11 16.44 3.11 16.44M3.11 16.44H7.63M3.11 16.44V21.44M2 12C2 6.48 6.44 2 12 2C18.67 2 22 7.56 22 7.56M22 7.56V2.56M22 7.56H17.56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ),
            onClick: onRefresh,
        },
        // Only show Brand List for Master terminals
        ...(isMaster ? [{
            id: "brandList",
            label: "Müəssisələr siyahısı",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="6" height="6" rx="1.5"></rect>
                    <rect x="14" y="4" width="6" height="6" rx="1.5"></rect>
                    <rect x="14" y="14" width="6" height="6" rx="1.5"></rect>
                    <rect x="4" y="14" width="6" height="6" rx="1.5"></rect>
                </svg>
            ),
            onClick: onBrandList,
        }] : []),
        {
            id: "downloadData",
            label: "Məlumatları yüklə",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"></path>
                    <path d="M14 2V8H20"></path>
                    <path d="M12 18V12"></path>
                    <path d="M9 15L12 18L15 15"></path>
                </svg>
            ),
            onClick: onDownloadData,
        },
        {
            id: "exit",
            label: "Terminaldan çıx",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            ),
            onClick: onExit,
            isDanger: true,
        },
        {
            id: "quitApp",
            label: "Proqramdan çıx",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M15 9L9 15"></path>
                    <path d="M9 9L15 15"></path>
                </svg>
            ),
            onClick: onQuitApp,
            isDanger: true,
        },
    ];

    return (
        <div className="settings-menu-overlay" onClick={handleOverlayClick}>
            <div className="settings-menu">
                {/* Header */}
                <div className="settings-menu-header">
                    <h3 className="settings-menu-title">Kontrol panel</h3>
                    <button className="settings-menu-close" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                {/* Menu Items */}
                <div className="settings-menu-items">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            className={`settings-menu-item ${item.isDanger ? "danger" : ""}`}
                            onClick={() => {
                                item.onClick?.();
                                onClose();
                            }}
                        >
                            <span className="settings-menu-item-icon">{item.icon}</span>
                            <span className="settings-menu-item-label">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SettingsMenu;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { authPos } from "../../redux/Slices/LoginSlice";
import { toast } from "sonner";
import apiConfig from "../../utils/apiConfig";
import ReturnCheckModal from "../ReturnCheckModal/ReturnCheckModal";
import SupportModal from "../SupportModal/SupportModal";
import ReportModal from "../ReportModal/ReportModal";
import CustomersSourceModal from "../Customers-Modal/CustomersSourceModal";
import DevicesModal from "./DevicesModal";
import RefreshLoader from "../RefreshLoader/RefreshLoader";
import "./Settings.css";

const Settings = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showCustomersModal, setShowCustomersModal] = useState(false);
    const [showDevicesModal, setShowDevicesModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
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

    const handleSoftRefresh = async () => {
        if (!loginedProfileData?.data?.profile?.id) {
            toast.error("Profil məlumatı yoxdur, səhifə yenilənə bilmədi.");
            return;
        }

        setIsRefreshing(true);
        const toastId = toast.loading("Məlumatlar yenilənir...");
        try {
            const profileId = loginedProfileData.data.profile.id;
            await Promise.all([
                apiConfig.post(`/sync/refresh/${profileId}`),
                dispatch(getTableGroups(profileId)).unwrap(),
                dispatch(getActiveOrders({ profileId })).unwrap(),
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);

            const storageData = JSON.parse(localStorage.getItem("profile"));
            if (storageData) {
                const data = await dispatch(authPos(storageData)).unwrap();
                localStorage.setItem("authResult", JSON.stringify(data));
                const profile = data?.data?.profile;

                if (Number(profile?.is_pos_block) === 1) {
                    toast.dismiss(toastId);
                    navigate("/block");
                    return;
                }

                if (profile?.next_payment_date) {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const paymentDate = new Date(profile.next_payment_date);
                    paymentDate.setHours(0, 0, 0, 0);
                    if (paymentDate < now) {
                        toast.dismiss(toastId);
                        navigate("/block");
                        return;
                    }
                }
            }

            toast.success("Məlumatlar uğurla yeniləndi!", { id: toastId });
        } catch (error) {
            console.error("Yeniləmə xətası:", error);
            toast.error("Yeniləmə zamanı xəta baş verdi.", { id: toastId });
        } finally {
            setIsRefreshing(false);
        }
    };

    const topMenuItems = [
        {
            id: "refund",
            label: "Geri qaytarılma",
            icon: <i className="bi bi-arrow-counterclockwise"></i>,
            permission: Number(loginedWaiter?.data?.can_return_receipt) === 1,
            onClick: () => setShowReturnModal(true),
        },
        {
            id: "report",
            label: "Hesabat yarat",
            icon: <i className="bi bi-file-earmark-text"></i>,
            permission: Number(loginedWaiter?.data?.can_create_report) === 1,
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
            permission: Number(loginedWaiter?.data?.can_view_customers) === 1,
            onClick: () => setShowCustomersModal(true),
        },
        {
            id: "archive",
            label: "Çek arxivi",
            icon: <i className="bi bi-archive"></i>,
            permission: Number(loginedWaiter?.data?.can_edit_all_checks) === 1,
            onClick: () => navigate("/checks"),
        },
        {
            id: "devices",
            label: "Cihazlar",
            icon: <i className="bi bi-laptop"></i>,
            highlight: true,
            onClick: () => setShowDevicesModal(true),
            permission: Number(loginedWaiter?.data?.can_access_settings) === 1 && Number(loginedWaiter?.data?.can_see_device) === 1,
        },
    ];

    const isMobile = window.innerWidth < 992;

    const bottomMenuItems = [
        {
            id: "refresh",
            label: "Yenilə",
            icon: <i className="bi bi-arrow-repeat"></i>,
            onClick: handleSoftRefresh,
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
            hiddenOnMobile: true,
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
            hiddenOnMobile: true,
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
                        {topMenuItems.filter(item => item.permission !== false).map((item) => (
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
                        {bottomMenuItems
                            .filter(item => !item.hiddenOnMobile || !isMobile)
                            .map((item) => (
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

            <DevicesModal
                show={showDevicesModal}
                onHide={() => setShowDevicesModal(false)}
            />

            {/* Refreshing Overlay */}
            <RefreshLoader isOpen={isRefreshing} />
        </>
    );
};

export default Settings;

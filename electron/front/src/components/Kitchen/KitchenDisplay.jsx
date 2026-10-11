import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import { getSocket, localApi } from "../../utils/apiConfig";
import { toast } from "sonner";
import { t } from "../../utils/translations";
import "./KitchenDisplay.css";
import { playNotificationSound } from "../../utils/notificationSound";

const TABS = [
    { key: "all", label: t("butun_cekler") },
    { key: "preparing", label: t("hazirlanir") },
    { key: "late", label: "Gecikir" },
    { key: "ready", label: t("hazirdir") },
];

const KitchenDisplay = () => {
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const storedAuthData = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("authResult") || "null");
        } catch {
            return null;
        }
    }, []);
    const storedProfileData = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("profile") || "null");
        } catch {
            return null;
        }
    }, []);
    const effectiveAuthData = loginedProfileData?.data ? loginedProfileData : storedAuthData;
    const profileId =
        effectiveAuthData?.data?.profile?.id ||
        storedProfileData?.id ||
        storedProfileData?.profile_id;
    const _terminalName =
        effectiveAuthData?.data?.terminal?.name ||
        storedProfileData?.terminal?.name ||
        "KDS";

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [currentTime, setCurrentTime] = useState(new Date());
    const prevOrdersCount = useRef(0);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);


    const fetchOrders = useCallback(async () => {
        if (!profileId) {
            setLoadError("Profil məlumatı tapılmadı");
            setLoading(false);
            return;
        }
        try {
            setLoadError("");
            const res = await localApi.get(`/kitchen/${profileId}/orders`);
            if (res.data.success) {
                const newOrders = res.data.data || [];
                if (newOrders.length > prevOrdersCount.current) playNotificationSound();
                setOrders(newOrders);
                prevOrdersCount.current = newOrders.length;
            }
        } catch (error) {
            console.error("KDS Fetch Error:", error);
            setLoadError(error?.response?.data?.message || t("kds_sifarislerini_yuklemek_mumkun_olmadi"));
        } finally {
            setLoading(false);
        }
    }, [profileId]);

    useEffect(() => {
        fetchOrders();
        const socket = getSocket();
        if (socket) {
            socket.on("kds_update_trigger", fetchOrders);
            socket.on("order_sent_to_kitchen", fetchOrders);
        }
        const interval = setInterval(fetchOrders, 20000);
        return () => {
            if (socket) {
                socket.off("kds_update_trigger", fetchOrders);
                socket.off("order_sent_to_kitchen", fetchOrders);
            }
            clearInterval(interval);
        };
    }, [fetchOrders]);

    const handleUpdateStatus = async (itemId, currentStatus) => {
        const nextStatus = currentStatus === 0 ? 1 : 2;
        try {
            const res = await localApi.patch(`/kitchen/item/${itemId}/status`, { status: nextStatus });
            if (res.data.success) {
                fetchOrders();
                if (nextStatus === 2) toast.success(t("mehsul_hazirdir"));
            }
        } catch {
            toast.error(t("error_occurred"));
        }
    };

    const handleAllDone = async (orderItems) => {
        try {
            const pendingItems = orderItems.filter(item => item.kds_status < 2);
            for (const item of pendingItems) {
                await localApi.patch(`/kitchen/item/${item.id}/status`, { status: 2 });
            }
            fetchOrders();
            toast.success(t("butun_masa_tamamlandi"));
        } catch {
            toast.error(t("error_occurred"));
        }
    };

    const getElapsedTime = (startTime) => {
        return Math.floor((new Date() - new Date(startTime)) / 60000);
    };

    const getItemTime = (item) => {
        if (!item.createdAt) return "";
        const d = new Date(item.createdAt);
        return d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
    };

    const groupItemsByCategories = (items) => {
        const groups = {};
        items.forEach(item => {
            const catName = item.product?.category?.name || t("diger");
            if (!groups[catName]) groups[catName] = [];
            groups[catName].push(item);
        });
        return groups;
    };

    const tabCounts = useMemo(() => {
        let preparing = 0, late = 0, ready = 0;
        orders.forEach(order => {
            const elapsed = getElapsedTime(order.createdAt);
            const allReady = order.orders_items?.every(i => i.kds_status === 2);
            const anyPreparing = order.orders_items?.some(i => i.kds_status === 1);
            if (allReady) { ready++; }
            else if (elapsed > 15) { late++; }
            else if (anyPreparing) { preparing++; }
        });
        return { all: orders.length, preparing, late, ready };
    }, [orders, currentTime]);

    const filteredOrders = useMemo(() => {
        if (activeTab === "all") return orders;
        return orders.filter(order => {
            const elapsed = getElapsedTime(order.createdAt);
            const allReady = order.orders_items?.every(i => i.kds_status === 2);
            const anyPreparing = order.orders_items?.some(i => i.kds_status === 1);
            if (activeTab === "ready") return allReady;
            if (activeTab === "late") return elapsed > 15 && !allReady;
            if (activeTab === "preparing") return anyPreparing && !allReady;
            return true;
        });
    }, [orders, activeTab, currentTime]);

    const getSaleTypeBadge = (order) => {
        const type = order.sale_type || order.saleType;
        if (!type) return null;
        const labels = {
            dine_in: "Məkanda",
            takeaway: t("takeaway"),
            delivery: t("delivery"),
            bolt_food: "Bolt Food",
            uber_eats: "Uber Eats",
            wolt: "Wolt",
        };
        return labels[type] || type;
    };

    if (loading) {
        return (
            <div className="kds-container">
                <div className="kds-empty-state">
                    <div className="kds-loader"><div className="kds-loader-ring"></div></div>
                    <h2>{t("loading")}</h2>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="kds-container">
                <div className="kds-empty-state">
                    <i className="bi bi-exclamation-triangle"></i>
                    <h2>{t("kds_acila_bilmedi")}</h2>
                    <p>{loadError}</p>
                    <button className="kds-complete-btn" onClick={fetchOrders}>{t("yeniden_yoxla")}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="kds-container no-select">
            <header className="kds-header">
                <div className="kds-header-left">
                    <nav className="kds-tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                className={`kds-tab ${activeTab === tab.key ? 'active' : ''} ${tab.key === 'late' && tabCounts.late > 0 ? 'has-late' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.label}
                                <span className={`kds-tab-badge ${tab.key}`}>
                                    {tabCounts[tab.key]}
                                </span>
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="kds-header-right">
                    <span className="kds-clock">
                        {currentTime.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </header>

            <main className="kds-grid">
                {filteredOrders.length === 0 ? (
                    <div className="kds-empty-state">
                        <i className="bi bi-cup-hot"></i>
                        <h2>{t("aktiv_sifaris_yoxdur")}</h2>
                        <p>{t("yeni_sifarisler_daxil_olanda_avtomatik_yenilenecek")}</p>
                    </div>
                ) : (
                    filteredOrders.map((order) => {
                        const elapsed = getElapsedTime(order.createdAt);
                        const isUrgent = elapsed > 20;
                        const groupedItems = groupItemsByCategories(order.orders_items);
                        const saleType = getSaleTypeBadge(order);

                        return (
                            <div key={order.uuid} className={`kds-card ${isUrgent ? 'urgent' : ''}`}>
                                <div className="kds-card-header">
                                    <div className="kds-card-title-row">
                                        <span className="kds-card-check">Çek №{order.id}</span>
                                        {saleType && (
                                            <span className={`kds-sale-badge ${order.sale_type || order.saleType || ''}`}>
                                                {saleType}
                                            </span>
                                        )}
                                    </div>
                                    <div className="kds-card-meta">
                                        <span>{order.waiter?.name || t("xidmetci")}</span>
                                        <span className="kds-meta-sep">/</span>
                                        <span>{order.table?.hall?.name || "Zal"}</span>
                                        <span className="kds-meta-sep">/</span>
                                        <span>{order.table?.name || t("table")}</span>
                                    </div>
                                </div>

                                <div className="kds-card-body">
                                    {Object.entries(groupedItems).map(([category, items], catIdx) => (
                                        <div key={category} className="kds-cat-group" data-cat-idx={catIdx % 6}>
                                            <div className="kds-cat-banner">
                                                <span>{category}</span>
                                            </div>
                                            {items.map((item) => {
                                                const isDone = item.kds_status === 2;
                                                const isPreparing = item.kds_status === 1;
                                                return (
                                                    <div key={item.id} className={`kds-item ${isPreparing ? 'preparing' : ''} ${isDone ? 'done' : ''}`}>
                                                        <div className="kds-item-left">
                                                            <span className="kds-item-qty">{item.count}x</span>
                                                            <div className="kds-item-info">
                                                                <span className="kds-item-name">{item.product?.name}</span>
                                                                {(item.comment || item.note) && <span className="kds-item-note">{item.comment || item.note}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="kds-item-right">
                                                            <span className="kds-item-time">{getItemTime(item)}</span>
                                                            {!isDone && (
                                                                <button
                                                                    className={`kds-status-btn ${isPreparing ? 'ready' : 'start'}`}
                                                                    onClick={() => handleUpdateStatus(item.id, item.kds_status)}
                                                                >
                                                                    {isPreparing ? 'HAZIR' : <i className="bi bi-play-fill"></i>}
                                                                </button>
                                                            )}
                                                            {isDone && (
                                                                <span className="kds-done-check">
                                                                    <i className="bi bi-check-lg"></i>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                <div className="kds-card-footer">
                                    {order.orders_items?.every(i => i.kds_status === 2) ? (
                                        <button className="kds-complete-btn done">
                                            <i className="bi bi-check2-all"></i>
                                            {t("hazirdir_boyuk")}
                                        </button>
                                    ) : (
                                        <button
                                            className="kds-complete-btn"
                                            onClick={() => handleAllDone(order.orders_items)}
                                        >
                                            {t("hamisini_qebul_et")}
                                        </button>
                                    )}
                                    <span className={`kds-elapsed ${elapsed > 20 ? 'danger' : elapsed > 12 ? 'warning' : ''}`}>
                                        {elapsed < 0 ? `${Math.abs(elapsed)}` : elapsed}:{String(Math.floor((new Date() - new Date(order.createdAt)) / 1000 % 60)).padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
};

export default KitchenDisplay;

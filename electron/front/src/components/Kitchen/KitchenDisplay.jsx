import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import apiConfig, { getSocket, localApi } from "../../utils/apiConfig";
import { toast } from "sonner";
import "./KitchenDisplay.css";
import uniposLogo from "../../assets/images/unipos_logo.png";

const KitchenDisplay = () => {
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const profileId = loginedProfileData?.data?.profile?.id;
    const terminalName = loginedProfileData?.data?.terminal?.name || "KDS Terminal";

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const prevOrdersCount = useRef(0);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const playNotificationSound = () => {
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.1, context.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.5);
        } catch (e) {}
    };

    const fetchOrders = useCallback(async () => {
        if (!profileId) return;
        try {
            const res = await localApi.get(`/kitchen/${profileId}/orders`);
            if (res.data.success) {
                const newOrders = res.data.data || [];
                if (newOrders.length > prevOrdersCount.current) {
                    playNotificationSound();
                }
                setOrders(newOrders);
                prevOrdersCount.current = newOrders.length;
            }
        } catch (error) {
            console.error("KDS Fetch Error:", error);
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
            const res = await localApi.post(`/kitchen/status/${itemId}`, { status: nextStatus });
            if (res.data.success) {
                fetchOrders();
                if (nextStatus === 2) toast.success("Məhsul hazırdır!");
            }
        } catch (error) {
            toast.error("Xəta baş verdi");
        }
    };

    const handleAllDone = async (orderItems) => {
        try {
            const pendingItems = orderItems.filter(item => item.kds_status < 2);
            for (const item of pendingItems) {
                await localApi.post(`/kitchen/status/${item.id}`, { status: 2 });
            }
            fetchOrders();
            toast.success("Bütün masa tamamlandı!");
        } catch (error) {
            toast.error("Xəta baş verdi");
        }
    };

    const getElapsedTime = (startTime) => {
        const diff = Math.floor((new Date() - new Date(startTime)) / 60000);
        return diff;
    };

    const groupItemsByCategories = (items) => {
        const groups = {};
        items.forEach(item => {
            const catName = item.product?.category?.name || "Digər";
            if (!groups[catName]) groups[catName] = [];
            groups[catName].push(item);
        });
        return groups;
    };

    if (loading) {
        return (
            <div className="kds-container">
                <div className="kds-empty-state">
                    <div className="premium-loader">
                        <div className="loader-ring"></div>
                    </div>
                    <h2>Məlumatlar yüklənir...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="kds-container no-select">
            <header className="kds-header">
                <div className="kds-brand">
                    <img src={uniposLogo} alt="UniPOS" className="kds-logo" />
                    <div className="kds-brand-text">
                        <h1>Kitchen Display</h1>
                        <span>Mətbəx İdarəetmə Sistemi</span>
                    </div>
                </div>

                <div className="kds-header-right">
                    <div className="header-stat">
                        <span className="label">Terminal</span>
                        <span className="value" style={{ fontSize: 14 }}>{terminalName}</span>
                    </div>
                    <div className="header-stat active-orders">
                        <span className="label">Aktiv Sifariş</span>
                        <span className="value">{orders.length}</span>
                    </div>
                    <div className="header-stat">
                        <span className="label">Cari Saat</span>
                        <span className="value" style={{ fontSize: 16 }}>
                            {currentTime.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
            </header>

            <main className="kds-grid">
                {orders.length === 0 ? (
                    <div className="kds-empty-state">
                        <i className="bi bi-cup-hot"></i>
                        <h2>Aktiv sifariş yoxdur</h2>
                        <p>Yeni sifarişlər daxil olanda bura avtomatik yenilənəcək</p>
                    </div>
                ) : (
                    orders.map((order) => {
                        const elapsed = getElapsedTime(order.createdAt);
                        const isUrgent = elapsed > 20;
                        const groupedItems = groupItemsByCategories(order.orders_items);

                        return (
                            <div key={order.uuid} className={`kds-order-card ${isUrgent ? 'urgent' : ''}`}>
                                <div className="order-header">
                                    <div className="order-top-row">
                                        <h3 className="table-num">
                                            {order.table?.name || "Masa"}
                                            <span className="order-id-badge">#{order.id}</span>
                                        </h3>
                                        <div className={`time-badge ${elapsed > 20 ? 'danger' : elapsed > 12 ? 'warning' : ''}`}>
                                            <i className="bi bi-stopwatch-fill"></i>
                                            {elapsed} DƏQ
                                        </div>
                                    </div>
                                    <div className="order-meta">
                                        <div className="meta-item">
                                            <i className="bi bi-person-fill"></i>
                                            {order.waiter?.name || "Xidmətçi"}
                                        </div>
                                        <div className="meta-item">
                                            <i className="bi bi-geo-alt-fill"></i>
                                            {order.table?.hall?.name || "Zal"}
                                        </div>
                                    </div>
                                </div>

                                <div className="order-items">
                                    {Object.entries(groupedItems).map(([category, items]) => (
                                        <div key={category} className="category-group">
                                            <div className="category-header">
                                                <span>{category}</span>
                                                <span className="cat-count">{items.length}</span>
                                            </div>
                                            {items.map((item) => (
                                                <div key={item.id} className={`kds-item ${item.kds_status === 1 ? 'preparing' : ''}`}>
                                                    <div className="item-left">
                                                        <span className="item-quantity">{item.count}×</span>
                                                        <div className="item-details">
                                                            <span className="item-name">{item.product?.name}</span>
                                                            {item.note && <span className="item-modifier">{item.note}</span>}
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="status-btn"
                                                        onClick={() => handleUpdateStatus(item.id, item.kds_status)}
                                                    >
                                                        {item.kds_status === 1 ? 'HAZIR' : 'BAŞLA'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>

                                <div className="order-footer">
                                    <button
                                        className="complete-all-btn"
                                        onClick={() => handleAllDone(order.orders_items)}
                                    >
                                        <i className="bi bi-check2-all"></i>
                                        Hamısını Qəbul Et
                                    </button>
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

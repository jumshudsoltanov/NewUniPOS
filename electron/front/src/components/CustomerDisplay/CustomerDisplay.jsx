import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./CustomerDisplay.css";
import uniposLogo from "../../assets/images/unipos_logo.png";
import CD_BG from "../../assets/images/PinContainerImagesDefault.jpg";
import { getCustomerFacingServiceFeeLabel } from "../../utils/posOperationNames";
import { t } from "../../utils/translations";
import { formatPrice } from "../../utils/formatPrice";

const CustomerDisplay = () => {
    const [orderData, setOrderData] = useState({ items: [], total: 0, received: 0, change: 0 });
    const [isConnected, setIsConnected] = useState(false);
    const [bgImage, setBgImage] = useState(CD_BG);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Enterprise Branding
    let fallbackProfileData = null;
    try {
        const authResultStr = localStorage.getItem("authResult");
        if (authResultStr) fallbackProfileData = JSON.parse(authResultStr);
    } catch (err) {
        console.error("Error parsing authResult:", err);
    }
    const profileInfo = fallbackProfileData?.data?.profile || {};
    const terminalInfo = fallbackProfileData?.data?.terminal || {};

    const validImg = (img) => {
        if (!img) return false;
        const strImg = String(img).trim().toLowerCase();
        if (strImg === "null" || strImg === "undefined" || strImg === "data:directory;base64,") return false;
        return true;
    };

    let enterpriseLogo = null;
    if (validImg(terminalInfo.logoPrint)) {
        enterpriseLogo = terminalInfo.logoPrint.startsWith("http") || terminalInfo.logoPrint.startsWith("data:")
            ? terminalInfo.logoPrint
            : `http://46.224.8.157:35627/${terminalInfo.logoPrint}`;
    } else if (validImg(profileInfo.logo)) {
        enterpriseLogo = profileInfo.logo.startsWith("http") || profileInfo.logo.startsWith("data:")
            ? profileInfo.logo
            : `http://46.224.8.157:35627/${profileInfo.logo}`;
    }

    const enterpriseName = profileInfo.restaurant_name || profileInfo.name || "";
    const branchName = terminalInfo.name || "";

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 2000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Try to get background from profile
        try {
            const authResult = JSON.parse(localStorage.getItem("authResult") || "{}");
            const profileBg = authResult?.data?.profile?.background_img;
            if (profileBg) {
                if (profileBg.startsWith("http") || profileBg.startsWith("data:")) {
                    setBgImage(profileBg);
                } else {
                    setBgImage(`http://46.224.8.157:35627/${profileBg}`);
                }
            }
        } catch (e) {
            console.error("Error loading bg image:", e);
        }
    }, []);

    useEffect(() => {
        let socketInstance = null;

        const init = async () => {
            let masterIp = null;
            if (window.electronAPI?.getStaticMasterIp) {
                try { masterIp = await window.electronAPI.getStaticMasterIp(); } catch (_) {}
            }
            const hostname = window.location.hostname || "localhost";
            const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
            const savedMasterIp = masterIp || localStorage.getItem("master_ip");
            const effectiveHostname = (isLocalhost && savedMasterIp) ? savedMasterIp : hostname;
            const backendUrl = `http://${effectiveHostname}:55667`;

            console.warn(`[CUSTOMER_DISPLAY] Connecting to socket at: ${backendUrl}`);

            socketInstance = io(backendUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 2000
            });

            socketInstance.on("connect", () => setIsConnected(true));
            socketInstance.on("disconnect", () => {
                setIsConnected(false);
                setOrderData({ items: [], total: 0, received: 0, change: 0 });
            });
            socketInstance.on("customer_display_update", (data) => setOrderData(data));
        };

        init();

        return () => {
            if (socketInstance) socketInstance.disconnect();
        };
    }, []);

    const calculateTotals = () => {
        if (!orderData || !orderData.items || orderData.items.length === 0) {
            return { subtotal: 0, totalDiscount: 0, deposit: 0, grandTotal: 0 };
        }

        let subtotal = 0;
        let totalDiscount = 0;

        orderData.items.forEach(item => {
            let itemPrice = Number(item.price || 0);
            let itemQty = Number(item.qty || 1);
            let itemDiscount = Number(item.discount || 0);

            let modifierTotal = 0;
            if (item.modifiers && Array.isArray(item.modifiers)) {
                item.modifiers.forEach(mod => {
                    modifierTotal += Number(mod.price || 0);
                });
            }

            const lineSubtotal = (itemPrice + modifierTotal) * itemQty;
            subtotal += lineSubtotal;

            if (item.is_discount_percent === 1) {
                totalDiscount += lineSubtotal * (itemDiscount / 100);
            } else {
                totalDiscount += itemDiscount;
            }
        });

        // Add receipt level discount
        let receiptDiscount = Number(orderData.discount || 0);
        if (orderData.is_discount_percent === 1) {
            receiptDiscount = subtotal * (receiptDiscount / 100);
        }
        totalDiscount += receiptDiscount;

        let serviceCharge = Number(orderData.service_charge || 0);
        let deposit = Number(orderData.deposit || 0);
        let deliveryFee = Number(orderData.delivery_fee || 0);

        let subtotalAfterDiscount = subtotal - totalDiscount;
        let grandTotal = Math.max(subtotalAfterDiscount + serviceCharge, deposit) + deliveryFee;

        return {
            subtotal,
            totalDiscount,
            serviceCharge,
            deposit,
            deliveryFee,
            grandTotal,
            isDepositFloor: deposit > (subtotalAfterDiscount + serviceCharge)
        };
    };

    const totals = calculateTotals();

    return (
        <div className="customer-display-container">
            {/* Left Side: Branding */}
            <div className="cd-left-panel" style={{ backgroundImage: `url(${bgImage})` }}>
                <div className="cd-overlay"></div>
                <div className="cd-brand-container">
                    <div className="cd-logo-badge">
                        <img src={uniposLogo} alt="UniPOS Tech" />
                        <span className="logo-text">UniPOS Tech</span>
                    </div>

                    <div className="cd-time-section">
                        <div className="cd-time">
                            {currentTime.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="cd-date">
                            {(() => {
                                const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
                                const weekdays = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
                                return `${currentTime.getDate()} ${months[currentTime.getMonth()]}, ${weekdays[currentTime.getDay()]}`;
                            })()}
                        </div>
                    </div>

                    <div className="cd-enterprise-branding">
                        {enterpriseLogo && (
                            <div className="cd-enterprise-logo">
                                <img src={enterpriseLogo} alt={branchName || enterpriseName} />
                            </div>
                        )}
                        <h1 className="cd-welcome-msg">
                            {branchName || enterpriseName || "UniPOS Tech"}
                        </h1>
                    </div>

                    <p className="cd-sub-msg">{t("unipos_tech_ile_her_sey_daha_asan")}</p>
                </div>
            </div>

            {/* Right Side: Cart Data */}
            <div className="cd-right-panel">
                <div className="cd-header">
                    <div className="cd-header-main">
                        <div className="cd-order-title">{t("sifarisiniz")}</div>
                        <div className="cd-order-details-grid">
                            {orderData?.table_name && (
                                <div className="cd-order-detail-item">
                                    <span className="label">Masa:</span>
                                    <span className="value">{orderData.table_name}</span>
                                </div>
                            )}
                            <div className="cd-order-detail-item">
                                <span className="label">{t("cek_1")}</span>
                                <span className="value">#{orderData?.check_id || "---"}</span>
                            </div>
                            <div className="cd-order-detail-item">
                                <span className="label">Qonaq:</span>
                                <span className="value">{orderData?.guest_count || 0}</span>
                            </div>
                            {orderData?.hall_name && (
                                <div className="cd-order-detail-item">
                                    <span className="label">Zal:</span>
                                    <span className="value">{orderData.hall_name}</span>
                                </div>
                            )}
                            {/* Timer Display */}
                            {orderData?.is_timer_status === 1 && (
                                <div className="cd-order-detail-item cd-timer-item">
                                    <span className="label">
                                        <i className="bi bi-stopwatch-fill"></i> Taymer:
                                    </span>
                                    <span className="value cd-timer-clock">{orderData.is_timer_clock || "00:00:00"}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={`cd-order-status ${!isConnected ? 'offline' : ''}`}>
                        {isConnected ? "Bağlantı var" : "Bağlantı gözlənilir..."}
                    </div>
                </div>

                <div className="cd-item-list-container">
                    <div className="cd-item-list-header">
                        <div className="header-col col-product">{t("product")}</div>
                        <div className="header-col col-qty">Say</div>
                        <div className="header-col col-total">{t("cem")}</div>
                    </div>

                    <div className="cd-item-list">
                        {!orderData || !orderData.items || orderData.items.length === 0 ? (
                            <div className="cd-empty-state">
                                <i className="bi bi-cart3"></i>
                                <h3>{t("sebet_bosdur")}</h3>
                            </div>
                        ) : (
                            orderData.items.map((item, index) => {
                                let itemPrice = Number(item.price || 0);
                                let modifierTotal = 0;
                                if (item.modifiers && Array.isArray(item.modifiers)) {
                                    item.modifiers.forEach(mod => {
                                        modifierTotal += Number(mod.price || 0);
                                    });
                                }
                                let effectiveUnit = itemPrice + modifierTotal;
                                let lineTotal = effectiveUnit * item.qty;

                                let itemDiscountAmount = 0;
                                if (item.discount > 0) {
                                    if (item.is_discount_percent === 1) {
                                        itemDiscountAmount = lineTotal * (Number(item.discount) / 100);
                                    } else {
                                        itemDiscountAmount = Number(item.discount);
                                    }
                                }

                                return (
                                    <div className="cd-item-row" key={index}>
                                        <div className="col-product">
                                            <div className="item-details">
                                                <span className="item-name">{item.name}</span>
                                                {item.modifiers && item.modifiers.length > 0 && (
                                                    <div className="item-modifiers">
                                                        {item.modifiers.map(m => `+${m.name}`).join(", ")}
                                                    </div>
                                                )}
                                                {itemDiscountAmount > 0 && (
                                                    <div className="item-discount">Endirim: -{formatPrice(itemDiscountAmount)}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-qty">
                                            <div className="qty-details">
                                                <span className="qty-value">{item.qty}</span>
                                                <span className="qty-price">x {effectiveUnit.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="col-total">
                                            {(lineTotal - itemDiscountAmount).toFixed(2)} ₼
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="cd-totals-section">
                    <div className="cd-total-row">
                        <span>{t("ara_cemi")}</span>
                        <span>{formatPrice(totals.subtotal)}</span>
                    </div>

                    {totals.totalDiscount > 0 && (
                        <div className="cd-total-row discount">
                            <span>Endirim:</span>
                            <span>-{formatPrice(totals.totalDiscount)}</span>
                        </div>
                    )}

                    {totals.serviceCharge > 0 && (
                        <div className="cd-total-row">
                            <span>{getCustomerFacingServiceFeeLabel()}:</span>
                            <span>{formatPrice(totals.serviceCharge)}</span>
                        </div>
                    )}

                    {totals.deposit > 0 && totals.isDepositFloor && (
                        <div className="cd-total-row">
                            <span>Depozit:</span>
                            <span>{formatPrice(totals.deposit)}</span>
                        </div>
                    )}

                    <div className="cd-grand-total">
                        <span className="label">{t("odenilecek_mebleg")}</span>
                        <span className="amount">{formatPrice(totals.grandTotal)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDisplay;
